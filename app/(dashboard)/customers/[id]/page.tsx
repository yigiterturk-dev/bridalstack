import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import PortalLinkButton from "@/components/portal-link-button";
import { updateCustomer } from "./actions";

type Props = { params: Promise<{ id: string }> };

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  // Her sorguda tenant_id: RLS yok, izolasyon burada kuruluyor.
  const [customer, appointments, orders, tryOnRows] = await Promise.all([
    prisma.customer.findFirst({ where: { id, tenant_id: tenant.id } }),
    prisma.appointment.findMany({ where: { customer_id: id, tenant_id: tenant.id }, orderBy: { appointment_date: "desc" }, take: 10 }),
    prisma.order.findMany({ where: { customer_id: id, tenant_id: tenant.id }, orderBy: { created_at: "desc" }, take: 10 }),
    prisma.tryOn.findMany({
      where: { customer_id: id, tenant_id: tenant.id },
      orderBy: { created_at: "desc" },
      take: 10,
      include: { product: { select: { name: true, category: true } } },
    }),
  ]);
  const tryOns = tryOnRows.map(({ product, ...t }) => ({ ...t, products: product }));

  if (!customer) redirect("/customers");

  const REACTION_EMOJI: Record<string, string> = { loved: "😍", liked: "👍", maybe: "🤔", no: "👎" };

  return (
    <div>
      <Link href="/customers" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">← Customers</Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info"}</p>
        </div>
        <PortalLinkButton customerId={customer.id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Edit Form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
          <form action={updateCustomer} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={customer.id} />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input name="name" defaultValue={customer.name} required className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
              <input name="phone" defaultValue={customer.phone ?? ""} className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input name="email" type="email" defaultValue={customer.email ?? ""} className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select name="status" defaultValue={customer.status ?? "new"} className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none">
                {["new", "hot_lead", "appointment_set", "fitting_done", "sold", "delivered", "lost"].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea name="notes" rows={3} defaultValue={customer.notes ?? ""} className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none resize-y" />
            </div>
            <button type="submit" className="mt-1 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">Save Changes</button>
          </form>
        </div>

        {/* Activity */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Orders */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Orders ({(orders ?? []).length})</h2>
              <Link href={`/orders/new?customer=${id}`} className="text-xs text-rose-500 hover:underline">+ New Order</Link>
            </div>
            {(orders ?? []).length > 0 ? (
              <div className="flex flex-col gap-2">
                {orders!.map((o) => (
                  <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div>
                      <span className="font-mono text-sm font-medium text-gray-900">{o.ref_no}</span>
                      <span className="text-xs text-gray-400 ml-2 capitalize">{o.order_type} · {o.status}</span>
                    </div>
                    <span className="font-semibold text-sm">${Number(o.discounted_total).toLocaleString()}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">No orders yet</p>}
          </div>

          {/* Appointments */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Appointments ({(appointments ?? []).length})</h2>
            {(appointments ?? []).length > 0 ? (
              <div className="flex flex-col gap-2">
                {appointments!.map((a) => {
                  const dt = new Date(a.appointment_date);
                  return (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{a.title ?? "Appointment"}</span>
                        <span className="text-xs text-gray-400 ml-2">{dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} {dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.status === "completed" ? "bg-green-100 text-green-700" : a.status === "confirmed" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{a.status}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-gray-400">No appointments yet</p>}
          </div>

          {/* Try-Ons */}
          {(tryOns ?? []).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Try-On History ({tryOns!.length})</h2>
              <div className="flex flex-col gap-2">
                {tryOns!.map((t) => {
                  const prod = (Array.isArray(t.products) ? t.products[0] : t.products) as { name: string; category: string | null } | null;
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                      <span className="text-xl">{t.reaction ? REACTION_EMOJI[t.reaction] : "👗"}</span>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">{prod?.name ?? "—"}</span>
                        {t.rating && <span className="text-xs text-amber-500 ml-2">{"★".repeat(t.rating)}</span>}
                        {t.notes && <p className="text-xs text-gray-500 mt-0.5">{t.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
