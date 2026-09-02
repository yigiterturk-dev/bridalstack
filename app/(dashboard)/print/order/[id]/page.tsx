import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import { deriveStatus } from "@/lib/installments";
import { kindLabel, lineNet, totals } from "@/lib/order-lines";
import PrintDocument from "@/components/print-document";
import PrintToolbar from "@/components/print-toolbar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const dateLong = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default async function OrderPrintPage({ params }: Props) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const [order, installments, items] = await Promise.all([
    prisma.order.findFirst({
      where: { id, tenant_id: tenant.id },
      include: { customer: { select: { name: true, phone: true, email: true } } },
    }),
    prisma.installment.findMany({
      where: { order_id: id, tenant_id: tenant.id, status: { not: "cancelled" } },
      orderBy: { installment_no: "asc" },
      select: { installment_no: true, total_count: true, amount: true, due_date: true, paid_at: true, status: true },
    }),
    prisma.orderLine.findMany({
      where: { order_id: id, order: { tenant_id: tenant.id } },
      orderBy: { position: "asc" },
    }),
  ]);
  if (!order) redirect("/orders");

  const rows = installments.map((i) => ({
    ...i,
    liveStatus: deriveStatus({
      due_date: i.due_date,
      paid_at: i.paid_at ? i.paid_at.toISOString() : null,
      status: i.status as never,
    }),
  }));
  const paid = rows.filter((r) => r.liveStatus === "paid").reduce((s, r) => s + r.amount, 0);
  const collected = order.deposit_amount + paid;
  const outstanding = Math.max(0, order.discounted_total - collected);

  const itemTotals = totals(items);

  const lines = [
    ...(items.length > 0 && itemTotals.discount > 0
      ? [{ label: "Subtotal", value: formatPrice(itemTotals.list) },
         { label: "Discount", value: `−${formatPrice(itemTotals.discount)}` }]
      : []),
    { label: "Order total", value: formatPrice(order.discounted_total) },
    { label: "Deposit paid", value: formatPrice(order.deposit_amount) },
    ...(paid > 0 ? [{ label: "Installments paid", value: formatPrice(paid) }] : []),
  ];

  return (
    <div className="py-2">
      <PrintToolbar backHref={`/orders/${order.id}`} backLabel="Back to order" />

      <PrintDocument
        shopName={tenant.name}
        logoUrl={tenant.logo_url}
        accentColor={tenant.accent_color}
        documentTitle="Invoice"
        reference={order.ref_no}
      >
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">Billed to</div>
            <div className="font-semibold">{order.customer?.name ?? "—"}</div>
            {order.customer?.phone && <div className="text-sm text-stone-500">{order.customer.phone}</div>}
            {order.customer?.email && <div className="text-sm text-stone-500">{order.customer.email}</div>}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">Details</div>
            <div className="text-sm">
              <span className="text-stone-400">Issued </span>
              {dateLong(order.order_date ? new Date(`${order.order_date}T00:00:00`) : order.created_at)}
            </div>
            {order.delivery_date && (
              <div className="text-sm">
                <span className="text-stone-400">Delivery </span>
                {dateLong(new Date(`${order.delivery_date}T00:00:00`))}
              </div>
            )}
            <div className="text-sm capitalize">
              <span className="text-stone-400">Type </span>
              {order.order_type}
            </div>
            {order.sales_person && (
              <div className="text-sm">
                <span className="text-stone-400">Stylist </span>
                {order.sales_person}
              </div>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <div className="print-keep mb-8">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-3">Items</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-400">
                  <th className="text-left py-2 font-semibold">Item</th>
                  <th className="text-right py-2 font-semibold">Qty</th>
                  <th className="text-right py-2 font-semibold">Price</th>
                  <th className="text-right py-2 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-stone-100">
                    <td className="py-2.5">
                      {item.description}
                      <span className="text-stone-400"> · {kindLabel(item.kind)}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-stone-500">{item.quantity}</td>
                    <td className="py-2.5 text-right tabular-nums text-stone-500">{formatPrice(item.unit_price)}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">{formatPrice(lineNet(item))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <table className="w-full text-sm mb-8">
          <tbody>
            {lines.map((l) => (
              <tr key={l.label} className="border-b border-stone-100">
                <td className="py-2.5 text-stone-500">{l.label}</td>
                <td className="py-2.5 text-right tabular-nums font-medium">{l.value}</td>
              </tr>
            ))}
            <tr>
              <td className="pt-4 font-bold">Balance due</td>
              <td className="pt-4 text-right tabular-nums font-bold text-lg">{formatPrice(outstanding)}</td>
            </tr>
          </tbody>
        </table>

        {rows.length > 0 && (
          <div className="print-keep mb-8">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-3">Payment plan</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-400">
                  <th className="text-left py-2 font-semibold">No</th>
                  <th className="text-left py-2 font-semibold">Due</th>
                  <th className="text-right py-2 font-semibold">Amount</th>
                  <th className="text-right py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.installment_no} className="border-b border-stone-100">
                    <td className="py-2 text-stone-500">{r.installment_no}/{r.total_count}</td>
                    <td className="py-2">{dateLong(new Date(`${r.due_date}T00:00:00`))}</td>
                    <td className="py-2 text-right tabular-nums">{formatPrice(r.amount)}</td>
                    <td className="py-2 text-right capitalize">
                      {r.liveStatus === "paid" ? (
                        <span className="text-emerald-700 font-medium">Paid</span>
                      ) : r.liveStatus === "overdue" ? (
                        <span className="text-rose-700 font-medium">Overdue</span>
                      ) : (
                        <span className="text-stone-500">{r.liveStatus}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {order.notes && (
          <div className="print-keep">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">Notes</div>
            <p className="text-sm text-stone-600 whitespace-pre-wrap leading-relaxed">{order.notes}</p>
          </div>
        )}
      </PrintDocument>
    </div>
  );
}
