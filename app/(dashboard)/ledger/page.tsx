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

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ period?: string }> };

export default async function LedgerPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="finance" enabledModules={tenant.enabled_modules}>
      <LedgerContent tenantId={tenant.id} period={params?.period} />
    </ModuleGuard>
  );
}

async function LedgerContent({ tenantId, period }: { tenantId: string; period?: string }) {
  const thisMonth = todayISO().slice(0, 7);
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
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight">Ledger</h1>
          <p className="text-stone-500 mt-2 font-medium">
            {totals.count === 0
              ? `Nothing recorded in ${formatPeriod(active)}`
              : `${formatPeriod(active)} · ${totals.count} entries`}
          </p>
        </div>
        <LedgerPeriodPicker periods={periods} active={active} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <Stat label="Money in" value={formatPrice(Math.round(totals.inflow))} tone="emerald" />
        <Stat label="Money out" value={formatPrice(Math.round(totals.outflow))} tone={totals.outflow > 0 ? "rose" : undefined} />
        <Stat
          label="Net"
          value={formatPrice(Math.round(totals.net))}
          tone={totals.net < 0 ? "rose" : undefined}
        />
      </div>

      {till.counted > 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Till counts</h2>
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
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
          <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 mx-auto mb-5 material-symbols-outlined text-[32px]">
            account_balance_wallet
          </span>
          <h3 className="text-xl font-bold text-stone-900 mb-2">This month is empty</h3>
          <p className="text-stone-500 max-w-md mx-auto">
            The ledger fills itself from the cash register, collected installments and cleared
            checks. Nothing here is typed twice.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4">Day by day</h2>
            <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-stone-400 border-b border-stone-100">
                      <th className="px-6 py-3">Day</th>
                      <th className="px-4 py-3 text-right">In</th>
                      <th className="px-4 py-3 text-right">Out</th>
                      <th className="px-6 py-3 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      <tr key={d.day} className="border-b border-stone-50 last:border-0">
                        <td className="px-6 py-3 font-semibold text-stone-900">
                          {new Date(`${d.day}T00:00:00Z`).toLocaleDateString("en-US", {
                            weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
                          {d.inflow > 0 ? formatPrice(Math.round(d.inflow)) : <span className="text-stone-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-rose-600">
                          {d.outflow > 0 ? formatPrice(Math.round(d.outflow)) : <span className="text-stone-300">—</span>}
                        </td>
                        <td className={`px-6 py-3 text-right tabular-nums font-bold ${d.net < 0 ? "text-rose-600" : "text-stone-900"}`}>
                          {formatPrice(Math.round(d.net))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <Breakdown title="Where it came from" rows={income} tone="emerald" />
            <Breakdown title="Where it went" rows={expense} tone="rose" />

            <div>
              <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4">By method</h2>
              <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-6 flex flex-col gap-3">
                {methods.map((m) => (
                  <div key={m.method} className="flex items-center justify-between">
                    <span className="text-sm text-stone-600">{m.label}</span>
                    <span className={`text-sm font-bold tabular-nums ${m.net < 0 ? "text-rose-600" : "text-stone-900"}`}>
                      {formatPrice(Math.round(m.net))}
                    </span>
                  </div>
                ))}
              </div>
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
      <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4">{title}</h2>
      <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-6 flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.category}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-stone-700">{r.label}</span>
              <span className="text-sm font-bold tabular-nums text-stone-900">{formatPrice(Math.round(r.total))}</span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${tone === "emerald" ? "bg-emerald-500" : "bg-rose-500"}`}
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
  const color = tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : "text-stone-900";
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-stone-200/60 shadow-sm px-5 py-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`text-2xl font-extrabold tabular-nums mt-1 ${color}`}>{value}</div>
    </div>
  );
}
