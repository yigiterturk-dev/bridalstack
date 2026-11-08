import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import ModuleGuard from "@/components/module-guard";
import { formatPeriod } from "@/lib/commissions";
import {
  summarize,
  groupByCategory,
  groupByMethod,
  dailyTotals,
  monthRange,
  todayISO,
  type Movement,
} from "@/lib/finance";
import { summarizeSessions, variance, verdict } from "@/lib/cash-session";
import LedgerPeriodPicker from "./period-picker";
import { normalizeTimeZone } from "@/lib/timezone";
import EmptyState from "@/components/empty-state";
import PageHead from "@/components/page-head";
import ListRow, { ListBox } from "@/components/list-row";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ period?: string }> };

export default async function LedgerPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="finance" enabledModules={tenant.enabled_modules}>
      <LedgerContent tenantId={tenant.id} timeZone={normalizeTimeZone(tenant.settings.time_zone)} period={params?.period} />
    </ModuleGuard>
  );
}

async function LedgerContent({ tenantId, timeZone, period }: { tenantId: string; timeZone: string; period?: string }) {
  const thisMonth = todayISO(new Date(), timeZone).slice(0, 7);
  const active = /^\d{4}-\d{2}$/.test(period ?? "") ? (period as string) : thisMonth;
  const { from, to } = monthRange(active);

  const [movements, months, sessions] = await Promise.all([
    prisma.cashMovement.findMany({
      where: { tenant_id: tenantId, occurred_on: { gte: from, lte: to } },
      orderBy: { occurred_on: "desc" },
    }),
    prisma.cashMovement.findMany({
      where: { tenant_id: tenantId },
      select: { occurred_on: true },
      distinct: ["occurred_on"],
      take: 800,
    }),
    prisma.cashSession.findMany({
      where: { tenant_id: tenantId, business_date: { gte: from, lte: to } },
      orderBy: { business_date: "asc" },
      select: {
        business_date: true, status: true, opening_float: true,
        counted_close: true, expected_close: true,
      },
    }),
  ]);

  const periods = [...new Set([thisMonth, ...months.map((m) => m.occurred_on.slice(0, 7))])].sort().reverse();
  // Kapanmış oturumların dondurulmuş değerleri okunur; geçmiş bir daha değişmez.
  const till = summarizeSessions(sessions);

  const list = movements as Movement[];
  const totals = summarize(list);
  const income = groupByCategory(list, "in");
  const expense = groupByCategory(list, "out");
  const methods = groupByMethod(list);
  const days = dailyTotals(list);

  return (
    <div className="animate-fade-in-up">
      <PageHead
        title="Money in & out"
        sub={totals.count === 0 ? `Nothing recorded in ${formatPeriod(active)}` : `${formatPeriod(active)} · ${totals.count} entries`}
      >
        <LedgerPeriodPicker periods={periods} active={active} />
      </PageHead>

      {(totals.inflow > 0 || totals.outflow > 0) && (
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Stat label="Money in" value={formatPrice(Math.round(totals.inflow))} tone="emerald" />
        <Stat label="Money out" value={formatPrice(Math.round(totals.outflow))} tone={totals.outflow > 0 ? "rose" : undefined} />
        <Stat
          label="Net"
          value={formatPrice(Math.round(totals.net))}
          tone={totals.net < 0 ? "rose" : undefined}
        />
      </div>
      )}

      {till.counted > 0 && (
        <div className="bg-white rounded-2xl border border-[var(--line)] p-6 mb-8">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-serif text-lg text-[var(--ink)]">Till counts</h2>
            <span className="text-xs text-stone-400">
              {till.counted} of {till.days} {till.days === 1 ? "day" : "days"} counted
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Balanced" value={String(till.exact)} tone={till.exact === till.counted ? "emerald" : undefined} />
            <Stat label="Over" value={String(till.over)} />
            <Stat label="Short" value={String(till.short)} tone={till.short > 0 ? "rose" : undefined} />
            <Stat
              label="Net difference"
              value={formatPrice(Math.round(till.netVariance))}
              tone={till.netVariance < 0 ? "rose" : till.netVariance > 0 ? "emerald" : undefined}
            />
          </div>

          {till.absVariance !== Math.abs(till.netVariance) && (
            <p className="text-xs text-stone-400 mb-1">
              Swings cancel out: {formatPrice(Math.round(till.absVariance))} of difference across the
              month nets to {formatPrice(Math.round(till.netVariance))}.
            </p>
          )}

          {till.worst && (
            <p className="text-xs text-stone-400">
              Biggest gap on {till.worst.business_date} —{" "}
              {formatPrice(Math.abs(Math.round(variance(till.worst, []) ?? 0)))}{" "}
              {verdict(variance(till.worst, [])) === "over" ? "over" : "short"}.
              {till.exact === till.counted && " Every counted day balanced."}
            </p>
          )}
        </div>
      )}

      {totals.count === 0 ? (
        <EmptyState icon="account_balance_wallet" action={{ href: "/cash", label: "Open the register" }} title="This month is empty">
          The ledger fills itself from the cash register, collected installments and cleared checks. Nothing here is typed twice.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <h2 className="mb-3 font-serif text-lg text-[var(--ink)]">Day by day</h2>
            <ListBox>
              {days.map((d) => {
                const parts = [
                  d.inflow > 0 ? `in ${formatPrice(Math.round(d.inflow))}` : null,
                  d.outflow > 0 ? `out ${formatPrice(Math.round(d.outflow))}` : null,
                ].filter(Boolean);
                return (
                  <ListRow
                    key={d.day}
                    title={new Date(`${d.day}T00:00:00Z`).toLocaleDateString("en-US", {
                      weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
                    })}
                    sub={parts.join(" · ") || "nothing moved"}
                    value={formatPrice(Math.round(d.net))}
                    valueTone={d.net < 0 ? "late" : "ink"}
                    valueSub="net"
                  />
                );
              })}
            </ListBox>
          </div>

          <div className="flex flex-col gap-6">
            <Breakdown title="Where it came from" rows={income} tone="emerald" />
            <Breakdown title="Where it went" rows={expense} tone="rose" />

            <div>
              <h2 className="mb-3 font-serif text-lg text-[var(--ink)]">By method</h2>
              <ListBox>
                {methods.map((m) => (
                  <ListRow key={m.method} title={m.label} value={formatPrice(Math.round(m.net))} valueTone={m.net < 0 ? "late" : "ink"} />
                ))}
              </ListBox>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { category: string; label: string; total: number; count: number }[];
  tone: "emerald" | "rose";
}) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.total));

  return (
    <div>
      <h2 className="mb-3 font-serif text-lg text-[var(--ink)]">{title}</h2>
      <div className="bg-white rounded-2xl border border-[var(--line)] p-6 flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.category}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-stone-700">{r.label}</span>
              <span className="text-sm font-bold tabular-nums text-[var(--ink)]">{formatPrice(Math.round(r.total))}</span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${tone === "emerald" ? "bg-gold" : "bg-stone-400"}`}
                style={{ width: `${Math.max(4, (r.total / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "rose" }) {
  const color = tone === "emerald" ? "text-[var(--ink)]" : tone === "rose" ? "text-late" : "text-[var(--ink)]";
  return (
    <div className="bg-white rounded-2xl border border-[var(--line)] px-5 py-4">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className={`mt-1 font-serif text-2xl tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
