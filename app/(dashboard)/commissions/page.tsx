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
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight">Commissions</h1>
          <p className="text-stone-500 mt-2 font-medium">
            {activeRules.length === 0
              ? "No rules yet — nothing is being earned"
              : `${formatPrice(Math.round(totalCommission))} earned on ${formatPrice(Math.round(totalRevenue))} of sales`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodPicker periods={periods} active={active} />
          <Link
            href="/commissions/rules"
            className="px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-stone-300"
          >
            Rules
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      {activeRules.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
          <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 mx-auto mb-5 material-symbols-outlined text-[32px]">
            payments
          </span>
          <h3 className="text-xl font-bold text-stone-900 mb-2">No commission rules yet</h3>
          <p className="text-stone-500 mb-8 max-w-md mx-auto">
            Write one rule — say 5% of every order — and this page turns your order history into a
            payable figure per stylist, month by month.
          </p>
          <Link
            href="/commissions/rules"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-stone-900 text-white font-semibold text-sm hover:bg-rose-600 transition-all duration-300"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Write your first rule
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4">
            {formatPeriod(active)}
          </h2>

          {rows.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-12 text-center">
              <h3 className="text-lg font-bold text-stone-900 mb-1">No orders this month</h3>
              <p className="text-stone-500">Nothing was sold in {formatPeriod(active)}.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mb-10">
              {rows.map((row) => {
                const payout = paidKey.get(`${row.staff.toLowerCase()}|${active}`);
                return (
                  <div key={row.staff} className="bg-white/70 backdrop-blur-xl rounded-2xl border border-stone-200/60 shadow-sm p-5 flex items-center gap-4 flex-wrap">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-amber-600 text-[20px]">badge</span>
                    </div>

                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-stone-900">{row.staff}</h3>
                        {payout && (
                          <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Paid {payout.paid_at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-stone-500 mt-0.5">
                        {row.orderCount} {row.orderCount === 1 ? "order" : "orders"} ·{" "}
                        {formatPrice(Math.round(row.revenue))} sold
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-extrabold tabular-nums text-stone-900">
                        {formatPrice(Math.round(row.commission))}
                      </div>
                      <div className="text-[11px] text-stone-400">commission</div>
                    </div>

                    <div className="flex-shrink-0">
                      {payout ? (
                        <form action={unmarkPaid}>
                          <input type="hidden" name="staff" value={row.staff} />
                          <input type="hidden" name="period" value={active} />
                          <button type="submit" className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50">
                            Undo
                          </button>
                        </form>
                      ) : (
                        <form action={markPaid}>
                          <input type="hidden" name="staff" value={row.staff} />
                          <input type="hidden" name="period" value={active} />
                          <button
                            type="submit"
                            disabled={row.commission <= 0}
                            className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-stone-900 text-white hover:bg-rose-600 disabled:opacity-30"
                          >
                            Mark paid
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4">
            Order by order
          </h2>
          <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase tracking-wide text-stone-400 border-b border-stone-100">
                    <th className="px-6 py-3">Order</th>
                    <th className="px-4 py-3">Stylist</th>
                    <th className="px-4 py-3">Rule applied</th>
                    <th className="px-4 py-3 text-right">Sale</th>
                    <th className="px-6 py-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {inPeriod.map((order) => {
                    const lines = linesByOrder.get(order.id) ?? [];
                    const amount = commissionFor(order, rules, lines);
                    // Tür kuralı işlediyse tek bir "uygulanan kural" yoktur;
                    // hangi türün hangi kuraldan kazandırdığı tek tek yazılır.
                    const breakdown = commissionBreakdown(order, rules, lines).filter((b) => b.rule);
                    const perKind = breakdown.some((b) => isKindRule(b.rule!));
                    const orderRule = isEarning(order) ? matchRule(order, rules) : null;
                    return (
                      <tr key={order.id} className="border-b border-stone-50 last:border-0">
                        <td className="px-6 py-3">
                          <Link href={`/orders/${order.id}`} className="font-semibold text-stone-900 hover:text-rose-600">
                            {order.ref_no}
                          </Link>
                          {!isEarning(order) && (
                            <span className="ml-2 text-[11px] font-semibold uppercase text-stone-400">{order.status}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-600">{salesPersonOf(order)}</td>
                        <td className="px-4 py-3 text-stone-400">
                          {perKind ? (
                            <span className="flex flex-col gap-0.5">
                              {breakdown.map((b) => (
                                <span key={b.kind}>
                                  <span className="text-stone-500">{kindLabel(b.kind)}</span>
                                  {" · "}
                                  {b.rule!.name}
                                </span>
                              ))}
                            </span>
                          ) : (
                            orderRule?.name ?? "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-stone-600">
                          {formatPrice(Math.round(order.discounted_total))}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums font-bold text-stone-900">
                          {amount > 0 ? formatPrice(Math.round(amount)) : <span className="text-stone-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
