import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";

type Props = { params: Promise<{ token: string }> };

export default async function ClientPortalPage({ params }: Props) {
  const { token } = await params;
  // Süresi dolmuş token geçersiz (expires_at null ise süresiz).
  const portal = await prisma.portalToken.findFirst({
    where: { token, OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] },
    select: {
      tenant_id: true, customer_id: true,
      tenant: { select: { name: true, slug: true, logo_url: true, accent_color: true } },
    },
  });

  if (!portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-500">This portal link is no longer valid. Please contact your stylist.</p>
        </div>
      </div>
    );
  }

  const tenant = portal.tenant;
  const shopName = tenant?.name ?? "Bridal Shop";
  const accent = tenant?.accent_color ?? "#e11d48";

  const scope = { customer_id: portal.customer_id, tenant_id: portal.tenant_id };
  const [customer, appointments, orders, tryOnRows] = await Promise.all([
    prisma.customer.findFirst({ where: { id: portal.customer_id, tenant_id: portal.tenant_id }, select: { name: true, phone: true, email: true, metadata: true } }),
    prisma.appointment.findMany({ where: scope, select: { title: true, appointment_date: true, status: true }, orderBy: { appointment_date: "asc" }, take: 10 }),
    prisma.order.findMany({ where: scope, select: { ref_no: true, order_type: true, status: true, discounted_total: true, remaining_balance: true, delivery_date: true }, orderBy: { created_at: "desc" }, take: 10 }),
    prisma.tryOn.findMany({
      where: scope,
      select: { reaction: true, rating: true, notes: true, photo_urls: true, created_at: true, product: { select: { name: true, category: true } } },
      orderBy: { created_at: "desc" }, take: 20,
    }),
  ]);

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-gray-400 mb-4 block" aria-hidden="true">person_off</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Portal unavailable</h1>
          <p className="text-gray-500">This client portal is no longer available. Please contact the boutique for a new link.</p>
        </div>
      </div>
    );
  }

  const tryOns = tryOnRows.map(({ product, ...t }) => ({ ...t, products: product }));

  const REACTION_EMOJI: Record<string, string> = { loved: "😍", liked: "👍", maybe: "🤔", no: "👎" };
  const STATUS_LABEL: Record<string, string> = { pending: "Upcoming", confirmed: "Confirmed", completed: "Done", cancelled: "Cancelled", draft: "Processing", delivered: "Delivered" };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">{shopName}</h1>
        <p className="text-gray-500 mt-1">Welcome, {customer?.name ?? "Bride"} ✨</p>
        {tenant?.slug && (
          <Link
            href={`/book/${tenant.slug}`}
            className="inline-flex items-center gap-1.5 mt-4 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 transition-colors"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-base">event</span>
            Book another appointment
          </Link>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Appointments */}
        {(appointments ?? []).length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined" aria-hidden="true" style={{ color: accent }}>event</span>
              Your Appointments
            </h2>
            <div className="flex flex-col gap-3">
              {appointments!.map((a, i) => {
                const dt = new Date(a.appointment_date);
                const isPast = dt < new Date();
                return (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${isPast ? "bg-gray-50" : "bg-rose-50"}`}>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{a.title ?? "Appointment"}</div>
                      <div className="text-xs text-gray-500">
                        {dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${a.status === "confirmed" ? "bg-blue-100 text-blue-700" : a.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Orders */}
        {(orders ?? []).length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined" aria-hidden="true" style={{ color: accent }}>receipt_long</span>
              Your Orders
            </h2>
            <div className="flex flex-col gap-3">
              {orders!.map((o, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{o.ref_no} · <span className="capitalize">{o.order_type}</span></div>
                    {o.delivery_date && <div className="text-xs text-gray-500">Delivery: {new Date(o.delivery_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 text-sm">${Number(o.discounted_total).toLocaleString()}</div>
                    {Number(o.remaining_balance) > 0 && (
                      <div className="text-xs text-red-600">Balance: ${Number(o.remaining_balance).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Try-On History */}
        {(tryOns ?? []).length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined" aria-hidden="true" style={{ color: accent }}>checkroom</span>
              Gowns You Tried
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tryOns!.map((t, i) => {
                const product = (Array.isArray(t.products) ? t.products[0] : t.products) as { name: string; category: string | null } | null;
                return (
                  <div key={i} className="p-4 rounded-xl border border-gray-100 hover:border-gray-300 transition-colors">
                    {(t.photo_urls as string[])?.length > 0 && (
                      <Image unoptimized src={(t.photo_urls as string[])[0]} alt={`${product?.name ?? "Gown"} try-on photo`} width={600} height={400} className="w-full h-40 object-cover rounded-lg mb-3" />
                    )}
                    <div className="font-medium text-gray-900 text-sm">{product?.name ?? "Gown"}</div>
                    {product?.category && <div className="text-xs text-gray-400">{product.category}</div>}
                    <div className="flex items-center gap-2 mt-2">
                      {t.reaction && <span className="text-lg">{REACTION_EMOJI[t.reaction] ?? ""}</span>}
                      {t.rating && (
                        <span className="text-xs text-gray-500">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</span>
                      )}
                    </div>
                    {t.notes && <p className="text-xs text-gray-500 mt-1">{t.notes}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {appointments.length === 0 && orders.length === 0 && tryOns.length === 0 && (
          <section className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-rose-400 mb-3 block" aria-hidden="true">auto_awesome</span>
            <h2 className="font-semibold text-gray-900">Your boutique is getting things ready</h2>
            <p className="text-sm text-gray-500 mt-2">There are no updates to show yet. Check back soon or contact your stylist if you have a question.</p>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center py-6">
          <p className="text-xs text-gray-400">Powered by <Link href="/landing" className="text-rose-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded">BridalStack</Link></p>
        </footer>
      </div>
    </div>
  );
}
