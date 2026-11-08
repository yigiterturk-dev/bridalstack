import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { RevenueBars, FillLine, StaffBars } from "@/components/analytics-charts";
import { formatPrice } from "@/config/modules";
import RangeFilter from "./range-filter";
import PageHead from "@/components/page-head";
import EmptyState from "@/components/empty-state";
import { dateInTimeZone, normalizeTimeZone, startOfDayInTimeZone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LOW_STOCK_THRESHOLD = 3;

type Props = { searchParams: Promise<{ range?: string }> };

/** Pazartesi 00:00 — haftalık doluluk grafiğinin başlangıcı. */
function startOfWeek(d: Date) {
  const start = new Date(d);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  return start;
}

/** "09:00" — "18:00" arasını saat cinsinden verir; bozuk değerde 0 döner. */
function hoursBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rangeDays = Math.min(365, Math.max(7, parseInt(sp.range ?? "30") || 30));

  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const modules = tenant.enabled_modules;
  const hasSales = modules.includes("sales");
  const hasAppointments = modules.includes("appointments");
  const hasInventory = modules.includes("inventory");
  const hasBooking = modules.includes("booking");

  const now = new Date();
  const tz = normalizeTimeZone((tenant.settings as Record<string, unknown> | null)?.time_zone);
  const rangeStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  // Ay sınırları dükkânın saat dilimine göre (sunucu saatine göre değil).
  const [tzYear, tzMonth] = dateInTimeZone(now, tz).split("-").map(Number); // tzMonth 1-12
  const monthKey = (y: number, m0: number) => {
    const d = new Date(Date.UTC(y, m0, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const revenueStartDate = `${monthKey(tzYear, tzMonth - 1 - 5)}-01`;
  const revenueStart = startOfDayInTimeZone(revenueStartDate, tz);
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const [
    orderAgg,
    revenueOrders,
    bookingAgg,
    apptTotal,
    apptDone,
    weekAppointments,
    schedules,
    staffBookings,
    members,
    products,
  ] = await Promise.all([
    hasSales
      ? prisma.order.aggregate({
          where: { tenant_id: tenant.id, status: { not: "cancelled" }, created_at: { gte: rangeStart } },
          _sum: { discounted_total: true },
        })
      : null,
    hasSales
      ? prisma.order.findMany({
          where: {
            tenant_id: tenant.id,
            status: { not: "cancelled" },
            OR: [{ created_at: { gte: revenueStart } }, { order_date: { gte: revenueStartDate } }],
          },
          select: { created_at: true, order_date: true, discounted_total: true },
        })
      : [],
    hasBooking
      ? prisma.booking.aggregate({
          where: { tenant_id: tenant.id, status: "completed", created_at: { gte: rangeStart } },
          _sum: { amount: true, tip_amount: true },
        })
      : null,
    hasAppointments
      ? prisma.appointment.count({
          where: { tenant_id: tenant.id, appointment_date: { gte: rangeStart, lte: now }, status: { not: "cancelled" } },
        })
      : 0,
    hasAppointments
      ? prisma.appointment.count({
          where: { tenant_id: tenant.id, appointment_date: { gte: rangeStart, lte: now }, status: "completed" },
        })
      : 0,
    hasAppointments
      ? prisma.appointment.findMany({
          where: {
            tenant_id: tenant.id,
            appointment_date: { gte: weekStart, lt: weekEnd },
            status: { not: "cancelled" },
          },
          select: { appointment_date: true },
        })
      : [],
    prisma.staffSchedule.findMany({
      where: { tenant_id: tenant.id, is_off: false },
      select: { day_of_week: true, start_time: true, end_time: true },
    }),
    hasBooking
      ? prisma.booking.groupBy({
          by: ["member_id"],
          where: {
            tenant_id: tenant.id,
            status: "completed",
            booking_date: { gte: weekStartStr, lt: weekEndStr },
          },
          _sum: { amount: true },
        })
      : [],
    prisma.tenantMember.findMany({
      where: { tenant_id: tenant.id },
      select: { id: true, display_name: true, title: true, user: { select: { name: true, email: true } } },
    }),
    hasInventory
      ? prisma.product.findMany({
          where: { tenant_id: tenant.id },
          select: { category: true, price: true, stock_quantity: true },
        })
      : [],
  ]);

  const totalRevenue = orderAgg?._sum.discounted_total ?? 0;
  const bookingRevenue = (bookingAgg?._sum.amount ?? 0) + (bookingAgg?._sum.tip_amount ?? 0);
  const fillRate = apptTotal > 0 ? Math.round((apptDone / apptTotal) * 100) : 0;
  const stockValue = products.reduce((s, p) => s + p.price * p.stock_quantity, 0);
  const lowStock = products.filter((p) => p.stock_quantity <= LOW_STOCK_THRESHOLD).length;

  // Son 6 ayın gelir serisi.
  const revenueBuckets: { key: string; label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const key = monthKey(tzYear, tzMonth - 1 - i);
    revenueBuckets.push({ key, label: MONTHS[Number(key.slice(5)) - 1], value: 0 });
  }
  for (const o of revenueOrders) {
    const bucket = revenueBuckets.find(
      // Reports ile aynı: sipariş tarihi varsa o, yoksa kayıt anı dükkân saatiyle.
      (b) => b.key === (o.order_date || dateInTimeZone(o.created_at, tz)).slice(0, 7),
    );
    if (bucket) bucket.value += o.discounted_total;
  }
  const revenueSeries = revenueBuckets.map(({ label, value }) => ({ label, value }));

  // Haftalık doluluk: kapasite personel vardiyalarından, dolu saatler randevulardan.
  // Vardiya tanımlı değilse gün başına 8 saatlik varsayılan kapasite kullanılır.
  const capacityByDay = new Array(7).fill(0) as number[];
  for (const s of schedules) {
    const idx = (s.day_of_week + 6) % 7;
    capacityByDay[idx] += hoursBetween(s.start_time, s.end_time);
  }
  const bookedByDay = new Array(7).fill(0) as number[];
  for (const a of weekAppointments) {
    bookedByDay[(a.appointment_date.getDay() + 6) % 7] += 1;
  }
  const fillSeries = DAYS.map((label, i) => ({
    label,
    booked: bookedByDay[i],
    capacity: Math.max(capacityByDay[i] > 0 ? Math.round(capacityByDay[i]) : 8, bookedByDay[i]),
  }));

  const memberName = (id: string | null) => {
    const m = members.find((x) => x.id === id);
    if (!m) return "Unassigned";
    const name = m.display_name || m.user.name || m.user.email;
    return m.title ? `${name} (${m.title})` : name;
  };
  const staffSeries = staffBookings
    .map((g) => ({ label: memberName(g.member_id), value: g._sum.amount ?? 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const categoryTotals = new Map<string, number>();
  for (const p of products) {
    const cat = p.category?.trim() || "Uncategorized";
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + p.stock_quantity);
  }
  const inventorySeries = [...categoryTotals.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // Her kart tek bir soruya cevap verir; alt satır cevabın neyi saydığını söyler.
  // Söyleyecek bir şeyi olmayan kart çıkmaz ("$0 styling", "0 of 0" gibi).
  const kpis = [
    hasSales && { label: "How much did I sell?", value: formatPrice(totalRevenue), sub: `Orders in the last ${rangeDays} days, cancelled left out` },
    hasBooking && bookingRevenue > 0 && { label: "What did styling bring in?", value: formatPrice(bookingRevenue), sub: `Completed bookings with tips, last ${rangeDays} days` },
    hasAppointments && apptTotal > 0 && { label: "How many appointments went ahead?", value: `${fillRate}%`, sub: `${apptDone} of ${apptTotal} that were due, last ${rangeDays} days` },
    hasInventory && products.length > 0 && { label: "What is my stock worth?", value: formatPrice(stockValue), sub: "Everything on the racks, at selling price" },
    hasInventory && lowStock > 0 && { label: "How many pieces are running low?", value: String(lowStock), sub: `${LOW_STOCK_THRESHOLD} or fewer left`, href: "/products" },
].filter(Boolean) as { label: string; value: string; sub: string; href?: string }[];

  const hasRevenueData = revenueSeries.some((r) => r.value > 0);
  const hasFillData = fillSeries.some((f) => f.booked > 0);

  return (
    <div className="animate-fade-in-up space-y-8">
      <PageHead title="Analytics" sub="How the shop is doing">
        <RangeFilter current={String(rangeDays)} />
      </PageHead>

      {kpis.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
          {kpis.map((k) => {
            const inner = (
              <>
                <div className="text-sm text-[var(--muted)]">{k.label}</div>
                <div className="mt-1 font-serif text-4xl tabular-nums text-[var(--ink)]">{k.value}</div>
                <div className="mt-1 text-sm text-stone-400">{k.sub}</div>
              </>
            );
            const cls = "block rounded-2xl border border-[var(--line)] bg-white p-5";
            return k.href ? (
              <Link key={k.label} href={k.href} className={`${cls} transition-colors hover:border-gold`}>{inner}</Link>
            ) : (
              <div key={k.label} className={cls}>{inner}</div>
            );
          })}
        </div>
      )}

      {hasRevenueData || hasFillData || staffSeries.length > 0 || inventorySeries.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hasSales && hasRevenueData && (
            <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
              <h3 className="font-serif text-lg text-[var(--ink)]">How much did I sell each month?</h3>
              <p className="mb-5 mt-0.5 text-sm text-[var(--muted)]">Last 6 months, cancelled orders left out</p>
              <RevenueBars data={revenueSeries} />
            </div>
          )}

          {hasAppointments && hasFillData && (
            <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
              <h3 className="font-serif text-lg text-[var(--ink)]">How full is this week?</h3>
              <p className="mb-5 mt-0.5 text-sm text-[var(--muted)]">Appointments booked against staff hours, Mon–Sun</p>
              <FillLine data={fillSeries} />
            </div>
          )}

          {staffSeries.length > 0 && (
            <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
              <h3 className="font-serif text-lg text-[var(--ink)]">Which stylist brought in the most this week?</h3>
              <p className="mb-5 mt-0.5 text-sm text-[var(--muted)]">Completed bookings, Mon–Sun</p>
              <StaffBars data={staffSeries} valueLabel="Revenue" />
            </div>
          )}

          {inventorySeries.length > 0 && (
            <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
              <h3 className="font-serif text-lg text-[var(--ink)]">What is on my racks?</h3>
              <p className="mb-5 mt-0.5 text-sm text-[var(--muted)]">Pieces in stock, by category</p>
              <ul className="flex flex-col gap-3">
                {inventorySeries.map((c) => (
                  <li key={c.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-[var(--ink)]">{c.name}</span>
                      <span className="tabular-nums text-[var(--muted)]">{c.value} {c.value === 1 ? "piece" : "pieces"}</span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100">
                      <div className="h-2 rounded-full bg-gold" style={{ width: `${Math.max(4, Math.round((c.value / inventorySeries[0].value) * 100))}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <EmptyState icon="insights" action={{ href: "/customers/new", label: "Add a bride" }} title="Not enough data yet">
          Add brides, orders and appointments and your charts will fill in here.
        </EmptyState>
      )}
    </div>
  );
}
