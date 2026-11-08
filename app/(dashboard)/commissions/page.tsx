import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import { kindLabel } from "@/lib/order-lines";
import ModuleGuard from "@/components/module-guard";
import {
  summarizeByStaff,
  periodOf,
  periodOptions,
  formatPeriod,
  commissionFor,
  matchRule,
  commissionBreakdown,
  isKindRule,
  type CommissionLine,
  isEarning,
  salesPersonOf,
  type CommissionOrder,
} from "@/lib/commissions";
import { markPaid, unmarkPaid } from "./actions";
import PeriodPicker from "./period-picker";
import EmptyState from "@/components/empty-state";
import PageHead, { BTN_PRIMARY, BTN_SECONDARY } from "@/components/page-head";
import ListRow, { ListBox } from "@/components/list-row";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "Only the owner can see and pay commissions.",
  nothing: "There is nothing to pay for that person this month.",
  invalid: "That period is not valid.",
};

type Props = { searchParams?: Promise<{ period?: string; error?: string; success?: string }> };

export default async function CommissionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="commissions" enabledModules={tenant.enabled_modules}>
      <CommissionsContent tenantId={tenant.id} period={params?.period} error={params?.error} />
    </ModuleGuard>
  );
}

async function CommissionsContent({
  tenantId,
  period,
  error,
}: {
  tenantId: string;
  period?: string;
  error?: string;
}) {
  const [orders, rules, payouts, orderLines] = await Promise.all([
    prisma.order.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      take: 2000,
      select: {
        id: true, ref_no: true, sales_person: true, status: true,
        discounted_total: true, order_date: true, created_at: true,
      },
    }),
    prisma.commissionRule.findMany({ where: { tenant_id: tenantId }, orderBy: { priority: "desc" } }),
    prisma.commissionPayout.findMany({ where: { tenant_id: tenantId } }),
    prisma.orderLine.findMany({
      where: { order: { tenant_id: tenantId } },
      select: { order_id: true, kind: true, quantity: true, unit_price: true, discount: true },
    }),
  ]);

  // Prim tür kırılımını okuyabilsin diye kalemler siparişe göre gruplanır.
  const linesByOrder = new Map<string, CommissionLine[]>();
  for (const { order_id, ...line } of orderLines) {
    const rows = linesByOrder.get(order_id) ?? [];
    rows.push(line);
    linesByOrder.set(order_id, rows);
  }

  const all = orders as CommissionOrder[];
  const periods = periodOptions(all);
  const active = period && periods.includes(period) ? period : periods[0];
  const inPeriod = all.filter((o) => periodOf(o) === active);
  const rows = summarizeByStaff(inPeriod, rules, linesByOrder);

  const paidKey = new Map(payouts.map((p) => [`${p.staff_name.toLowerCase()}|${p.period}`, p]));
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  const activeRules = rules.filter((r) => r.is_active);

  return (
    <div className="animate-fade-in-up">
      <PageHead
        title="Commissions"
        sub={activeRules.length === 0
          ? "No rules yet — nothing is being earned"
          : `${formatPrice(Math.round(totalCommission))} earned on ${formatPrice(Math.round(totalRevenue))} of sales`}
      >
        <PeriodPicker periods={periods} active={active} />
        <Link href="/commissions/rules" className={BTN_SECONDARY}>Rules</Link>
      </PageHead>

      {error && (
        <div className="mb-6 rounded-2xl border border-gold/30 bg-gold-soft px-5 py-3 text-sm font-medium text-gold">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      {activeRules.length === 0 ? (
        <EmptyState icon="payments" action={{ href: "/commissions/rules", label: "Write your first rule" }} title="No commission rules yet">
          Write one rule — say 5% of every order — and this page turns your order history into a payable figure per stylist, month by month.
        </EmptyState>
      ) : (
        <>
          <h2 className="mb-3 font-serif text-lg text-[var(--ink)]">{formatPeriod(active)}</h2>

          {rows.length === 0 ? (
            <EmptyState action={{ href: "/orders/new", label: "New order" }} title="No orders this month">
              Nothing was sold in {formatPeriod(active)}.
            </EmptyState>
          ) : (
            <div className="mb-10">
              <ListBox>
                {rows.map((row) => {
                  const payout = paidKey.get(`${row.staff.toLowerCase()}|${active}`);
                  return (
                    <div key={row.staff} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${payout ? "bg-[var(--line)]" : "bg-gold"}`} />
                          <span className="truncate font-medium text-[var(--ink)]">{row.staff}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-[var(--muted)]">
                          {row.orderCount} {row.orderCount === 1 ? "order" : "orders"} · {formatPrice(Math.round(row.revenue))} sold
                          {payout && ` · paid ${payout.paid_at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        <div className="text-right">
                          <div className="font-serif text-lg tabular-nums text-[var(--ink)]">{formatPrice(Math.round(row.commission))}</div>
                          <div className="text-xs text-[var(--muted)]">commission</div>
                        </div>
                        {payout ? (
                          <form action={unmarkPaid}>
                            <input type="hidden" name="staff" value={row.staff} />
                            <input type="hidden" name="period" value={active} />
                            <button type="submit" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Undo</button>
                          </form>
                        ) : (
                          <form action={markPaid}>
                            <input type="hidden" name="staff" value={row.staff} />
                            <input type="hidden" name="period" value={active} />
                            <button type="submit" disabled={row.commission <= 0} className={`${BTN_PRIMARY} disabled:opacity-30`}>
                              Mark paid
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })}
              </ListBox>
            </div>
          )}

          <h2 className="mb-3 font-serif text-lg text-[var(--ink)]">Order by order</h2>
          <ListBox>
            {inPeriod.map((order) => {
              const lines = linesByOrder.get(order.id) ?? [];
              const amount = commissionFor(order, rules, lines);
              // Tür kuralı işlediyse tek bir "uygulanan kural" yoktur;
              // hangi türün hangi kuraldan kazandırdığı tek tek yazılır.
              const breakdown = commissionBreakdown(order, rules, lines).filter((b) => b.rule);
              const perKind = breakdown.some((b) => isKindRule(b.rule!));
              const orderRule = isEarning(order) ? matchRule(order, rules) : null;
              const ruleText = perKind
                ? breakdown.map((b) => `${kindLabel(b.kind)}: ${b.rule!.name}`).join(", ")
                : orderRule?.name ?? "no rule";
              return (
                <ListRow
                  key={order.id}
                  href={`/orders/${order.id}`}
                  title={order.ref_no}
                  sub={`${salesPersonOf(order)} · ${isEarning(order) ? ruleText : order.status}`}
                  value={amount > 0 ? formatPrice(Math.round(amount)) : "—"}
                  valueTone={amount > 0 ? "ink" : "muted"}
                  valueSub={`of ${formatPrice(Math.round(order.discounted_total))}`}
                />
              );
            })}
          </ListBox>
        </>
      )}
    </div>
  );
}
