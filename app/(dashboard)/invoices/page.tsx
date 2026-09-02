import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import ModuleGuard from "@/components/module-guard";
import {
  buildReceivables,
  summarizeAging,
  totalOutstanding,
  AGING_LABELS,
  type AgingBucket,
} from "@/lib/receivables";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ bucket?: string }> };

const BUCKET_ORDER: AgingBucket[] = ["current", "d1_30", "d31_60", "d61_plus"];

const BUCKET_STYLE: Record<AgingBucket, string> = {
  current: "text-stone-600",
  d1_30: "text-amber-600",
  d31_60: "text-orange-600",
  d61_plus: "text-rose-600",
};

export default async function InvoicesPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="invoices" enabledModules={tenant.enabled_modules}>
      <InvoicesContent tenantId={tenant.id} bucket={params?.bucket} />
    </ModuleGuard>
  );
}

async function InvoicesContent({ tenantId, bucket }: { tenantId: string; bucket?: string }) {
  const [orders, installments] = await Promise.all([
    prisma.order.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      take: 500,
      select: {
        id: true, ref_no: true, customer_id: true, status: true,
        discounted_total: true, deposit_amount: true, order_date: true, created_at: true,
      },
    }),
    prisma.installment.findMany({
      where: { tenant_id: tenantId },
      select: { order_id: true, amount: true, due_date: true, paid_at: true, status: true },
    }),
  ]);

  const all = buildReceivables(orders, installments);
  const summary = summarizeAging(all);
  const outstanding = totalOutstanding(all);

  const active = BUCKET_ORDER.includes(bucket as AgingBucket) ? (bucket as AgingBucket) : null;
  const rows = active ? all.filter((r) => r.bucket === active) : all;

  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const customers = customerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds }, tenant_id: tenantId },
        select: { id: true, name: true, phone: true },
      })
    : [];
  const customerById = new Map(customers.map((c) => [c.id, c]));

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight flex items-center gap-3">
          Invoices <span className="text-rose-400 font-normal">✧</span>
        </h1>
        <p className="text-stone-500 mt-2 font-medium">
          {all.length === 0
            ? "Nothing outstanding — every order is paid in full"
            : `${formatPrice(Math.round(outstanding))} outstanding across ${all.length} ${all.length === 1 ? "order" : "orders"}`}
        </p>
      </div>

      {all.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {BUCKET_ORDER.map((b) => {
            const isActive = active === b;
            return (
              <Link
                key={b}
                href={isActive ? "/invoices" : `/invoices?bucket=${b}`}
                className={`bg-white/60 backdrop-blur-md rounded-2xl p-5 border transition-all duration-300 ${
                  isActive
                    ? "border-stone-900 shadow-sm"
                    : "border-stone-200/60 hover:border-stone-300"
                }`}
              >
                <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                  {AGING_LABELS[b]}
                </div>
                <div className={`text-2xl font-extrabold tabular-nums ${BUCKET_STYLE[b]}`}>
                  {formatPrice(Math.round(summary[b].amount))}
                </div>
                <div className="text-xs text-stone-400 mt-1">
                  {summary[b].count} {summary[b].count === 1 ? "order" : "orders"}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {rows.length > 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/50 border-b border-stone-100/80">
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Reference</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Next due</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Total</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Collected</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Outstanding</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100/50">
                {rows.map((r) => {
                  const c = customerById.get(r.customer_id);
                  return (
                    <tr key={r.orderId} className="hover:bg-white/80 transition-colors group">
                      <td className="px-6 py-5">
                        <Link href={`/orders/${r.orderId}`} className="font-mono text-sm font-bold text-stone-900 group-hover:text-rose-600 transition-colors">
                          {r.ref_no}
                        </Link>
                        {r.installmentCount > 0 && (
                          <div className="text-[11px] text-stone-400 mt-0.5">
                            {r.paidCount}/{r.installmentCount} installments paid
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-semibold text-stone-800">{c?.name ?? "—"}</div>
                        {c?.phone && <div className="text-xs text-stone-400">{c.phone}</div>}
                      </td>
                      <td className="px-6 py-5">
                        {r.nextDueDate ? (
                          <>
                            <div className="text-sm text-stone-700">
                              {new Date(`${r.nextDueDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </div>
                            {r.daysOverdue > 0 && (
                              <div className={`text-xs font-semibold ${BUCKET_STYLE[r.bucket]}`}>
                                {r.daysOverdue} {r.daysOverdue === 1 ? "day" : "days"} overdue
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-stone-400">No plan</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right text-sm text-stone-500 tabular-nums">{formatPrice(r.total)}</td>
                      <td className="px-6 py-5 text-right text-sm text-emerald-600 tabular-nums">{formatPrice(r.collected)}</td>
                      <td className="px-6 py-5 text-right text-sm font-bold text-stone-900 tabular-nums">{formatPrice(r.outstanding)}</td>
                      <td className="px-6 py-5 text-right">
                        <Link
                          href={`/print/order/${r.orderId}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">print</span>
                          Print
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
          <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-500 mx-auto mb-5 material-symbols-outlined text-[32px]">
            task_alt
          </span>
          <h3 className="text-xl font-bold text-stone-900 mb-2">
            {active ? "Nothing in this range" : "Everything is paid"}
          </h3>
          <p className="text-stone-500">
            {active ? (
              <Link href="/invoices" className="font-semibold text-stone-700 hover:text-rose-600">
                Show all outstanding invoices
              </Link>
            ) : (
              "No order has money still owed on it."
            )}
          </p>
        </div>
      )}
    </div>
  );
}
