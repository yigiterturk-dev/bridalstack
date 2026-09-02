import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { updateOrderStatus } from "./actions";

const STATUSES = ["draft", "confirmed", "in_progress", "delivered", "completed", "cancelled"];

type Props = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const order = await prisma.order.findFirst({
    where: { id, tenant_id: tenant.id },
    include: { customer: { select: { name: true, phone: true, email: true } } },
  });
  if (!order) redirect("/orders");

  const customer = order.customer;
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
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[order.status] ?? STATUS_STYLE.draft}`}>{order.status}</span>
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
    </div>
  );
}
