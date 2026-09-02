import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { formatPrice } from "@/config/modules";
import { deriveStatus } from "@/lib/installments";
import SelectField from "@/components/select-field";
import {
  updateOrderStatus,
  createInstallmentPlan,
  markInstallmentPaid,
  markInstallmentUnpaid,
  cancelInstallmentPlan,
} from "./actions";

const STATUSES = ["draft", "confirmed", "in_progress", "delivered", "completed", "cancelled"];

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
};

const PLAN_ERRORS: Record<string, string> = {
  forbidden: "You do not have permission to change payment plans.",
  count: "Choose between 1 and 60 installments.",
  due_date: "Pick a valid first due date.",
  amount: "Enter an amount greater than zero.",
  plan_exists: "This order already has a payment plan. Cancel it before creating a new one.",
};

const PLAN_MESSAGES: Record<string, string> = {
  plan_created: "Payment plan created.",
  paid: "Installment marked as paid.",
  unpaid: "Installment reopened.",
  plan_cancelled: "Payment plan cancelled.",
};

/** Varsayılan ilk vade: bugünden 30 gün sonra. Zaman okuma render dışında. */
function defaultDueDate(): string {
  return new Date(Date.now() + 30 * 864e5).toISOString().split("T")[0];
}

const INSTALLMENT_STYLE: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  due: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-500",
  pending: "bg-gray-100 text-gray-600",
};

export default async function OrderDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const [order, member, installments] = await Promise.all([
    prisma.order.findFirst({
      where: { id, tenant_id: tenant.id },
      include: { customer: { select: { name: true, phone: true, email: true } } },
    }),
    getCurrentMember(),
    prisma.installment.findMany({
      where: { order_id: id, tenant_id: tenant.id },
      orderBy: { installment_no: "asc" },
      select: { id: true, installment_no: true, total_count: true, amount: true, due_date: true, paid_at: true, status: true },
    }),
  ]);
  if (!order) redirect("/orders");

  const customer = order.customer;
  const canManage = hasPermission(member?.role, "orders.manage");

  // Kayıtlı durum cron çalışana kadar bayat kalabilir; görüntülerken tazeliyoruz.
  const rows = installments.map((i) => ({
    ...i,
    liveStatus: deriveStatus({
      due_date: i.due_date,
      paid_at: i.paid_at ? i.paid_at.toISOString() : null,
      status: i.status as never,
    }),
  }));
  const activeRows = rows.filter((r) => r.liveStatus !== "cancelled");
  const paidTotal = activeRows.filter((r) => r.liveStatus === "paid").reduce((s, r) => s + r.amount, 0);
  const planTotal = activeRows.reduce((s, r) => s + r.amount, 0);
  const overdueCount = activeRows.filter((r) => r.liveStatus === "overdue").length;
  const hasPlan = activeRows.length > 0;
  const defaultFirstDue = defaultDueDate();
  const STATUS_STYLE: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700", confirmed: "bg-blue-100 text-blue-700", in_progress: "bg-amber-100 text-amber-700",
    delivered: "bg-green-100 text-green-700", completed: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <Link href="/orders" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">← Orders</Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{order.ref_no}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {customer?.name ?? "—"} · <span className="capitalize">{order.order_type}</span> · {order.order_date ? new Date(order.order_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/print/order/${order.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Invoice
          </Link>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[order.status] ?? STATUS_STYLE.draft}`}>{order.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Order Details</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total", value: `$${Number(order.discounted_total).toLocaleString()}`, bold: true },
                { label: "Deposit", value: `$${Number(order.deposit_amount).toLocaleString()}` },
                { label: "Balance", value: `$${Number(order.remaining_balance).toLocaleString()}`, color: Number(order.remaining_balance) > 0 ? "text-red-600" : "text-green-600" },
                { label: "Delivery", value: order.delivery_date ? new Date(order.delivery_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD" },
              ].map((item) => (
                <div key={item.label} className="p-4 rounded-xl bg-gray-50">
                  <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                  <div className={`text-lg font-bold ${item.color ?? "text-gray-900"}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Customer</h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-lg">
                {customer?.name?.charAt(0) ?? "?"}
              </div>
              <div>
                <Link href={`/customers/${order.customer_id}`} className="font-medium text-gray-900 hover:text-rose-600">{customer?.name ?? "—"}</Link>
                <p className="text-sm text-gray-500">{[customer?.phone, customer?.email].filter(Boolean).join(" · ") || "No contact info"}</p>
              </div>
            </div>
          </div>

          {order.notes && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-2">Notes</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Update Status</h2>
            <div className="flex flex-col gap-2">
              {STATUSES.map((s) => (
                <form key={s} action={updateOrderStatus}>
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="status" value={s} />
                  <button
                    type="submit"
                    disabled={order.status === s}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors capitalize ${
                      order.status === s ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {s.replace(/_/g, " ")}
                  </button>
                </form>
              ))}
            </div>
          </div>

          {order.sales_person && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="text-xs text-gray-500 mb-1">Sales Person</div>
              <div className="font-medium text-gray-900">{order.sales_person}</div>
            </div>
          )}
        </div>
      </div>

      {/* Payment plan */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className="font-semibold text-gray-900">Payment Plan</h2>
          {hasPlan && (
            <div className="text-sm text-gray-500">
              {formatPrice(paidTotal)} collected of {formatPrice(planTotal)}
              {overdueCount > 0 && (
                <span className="ml-3 text-red-600 font-medium">
                  {overdueCount} overdue
                </span>
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Reminder emails go out automatically three days before each due date, on the day, and once overdue.
        </p>

        {sp?.success && PLAN_MESSAGES[sp.success] && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {PLAN_MESSAGES[sp.success]}
          </div>
        )}
        {sp?.error && PLAN_ERRORS[sp.error] && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {PLAN_ERRORS[sp.error]}
          </div>
        )}

        {hasPlan ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase">
                    <th className="p-3">#</th>
                    <th className="p-3">Due date</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.id} className={r.liveStatus === "cancelled" ? "opacity-50" : ""}>
                      <td className="p-3 font-medium text-gray-700">{r.installment_no}/{r.total_count}</td>
                      <td className="p-3 text-gray-700">
                        {new Date(r.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="p-3 text-right font-semibold text-gray-900 tabular-nums">{formatPrice(r.amount)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${INSTALLMENT_STYLE[r.liveStatus] ?? INSTALLMENT_STYLE.pending}`}>
                          {r.liveStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {canManage && r.liveStatus !== "cancelled" && (
                          <form action={r.liveStatus === "paid" ? markInstallmentUnpaid : markInstallmentPaid}>
                            <input type="hidden" name="order_id" value={order.id} />
                            <input type="hidden" name="id" value={r.id} />
                            <button
                              type="submit"
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                r.liveStatus === "paid"
                                  ? "border border-gray-200 text-gray-600 hover:bg-gray-50"
                                  : "bg-green-600 text-white hover:bg-green-700"
                              }`}
                            >
                              {r.liveStatus === "paid" ? "Undo" : "Mark paid"}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canManage && (
              <form action={cancelInstallmentPlan} className="mt-5">
                <input type="hidden" name="order_id" value={order.id} />
                <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700">
                  Cancel unpaid installments
                </button>
              </form>
            )}
          </>
        ) : canManage ? (
          <form action={createInstallmentPlan} className="grid sm:grid-cols-4 gap-4 items-end">
            <input type="hidden" name="order_id" value={order.id} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount to split</label>
              <input
                name="amount" type="number" step="0.01" min="0.01"
                defaultValue={order.remaining_balance > 0 ? order.remaining_balance : undefined}
                placeholder="Remaining balance"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Installments</label>
              <input
                name="count" type="number" min="1" max="60" required defaultValue={6}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First due date</label>
              <input
                name="first_due" type="date" required defaultValue={defaultFirstDue}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Every</label>
              <SelectField
                name="interval"
                defaultValue="1"
                searchable={false}
                options={[
                  { value: "1", label: "Month" },
                  { value: "2", label: "2 months" },
                  { value: "3", label: "Quarter" },
                ]}
              />
            </div>
            <div className="sm:col-span-4">
              <button type="submit" className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">
                Create payment plan
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-500">No payment plan on this order yet.</p>
        )}
      </div>
    </div>
  );
}
