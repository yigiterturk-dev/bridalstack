import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { RevenueBars, FillLine, StaffBars, DistributionPie } from "@/components/analytics-charts";
import { formatPrice } from "@/config/modules";
import RangeFilter from "./range-filter";

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
  const rangeStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const revenueStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
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
          where: { tenant_id: tenant.id, status: { not: "cancelled" }, created_at: { gte: revenueStart } },
          select: { created_at: true, discounted_total: true },
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
          where: { tenant_id: tenant.id, appointment_date: { gte: rangeStart }, status: { not: "cancelled" } },
        })
      : 0,
    hasAppointments
      ? prisma.appointment.count({
          where: { tenant_id: tenant.id, appointment_date: { gte: rangeStart }, status: "completed" },
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
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    revenueBuckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS[d.getMonth()], value: 0 });
  }
  for (const o of revenueOrders) {
    const bucket = revenueBuckets.find((b) => b.key === `${o.created_at.getFullYear()}-${o.created_at.getMonth()}`);
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

  const kpis = [
    hasSales && { label: "Total Revenue", value: formatPrice(totalRevenue), sub: `from orders · last ${rangeDays} days` },
    hasBooking && { label: "Styling Fees", value: formatPrice(bookingRevenue), sub: "completed bookings" },
    hasAppointments && { label: "Completion Rate", value: `${fillRate}%`, sub: `${apptDone}/${apptTotal} appointments` },
    hasInventory && { label: "Inventory Value", value: formatPrice(stockValue), sub: `${lowStock} low stock items` },
  ].filter(Boolean) as { label: string; value: string; sub: string }[];

  const hasRevenueData = revenueSeries.some((r) => r.value > 0);
  const hasFillData = fillSeries.some((f) => f.booked > 0);

  return (
    <div className="animate-fade-in-up space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight flex items-center gap-3">
            Analytics <span className="text-rose-400 font-normal">✧</span>
          </h1>
          <p className="text-stone-500 mt-2 font-medium">{tenant.name} — business performance</p>
        </div>
        <div>
          <RangeFilter current={String(rangeDays)} />
        </div>
      </div>

      {kpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {kpis.map((k, i) => (
            <div key={k.label} className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-stone-200/60 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:border-rose-200 hover:shadow-[0_10px_30px_-10px_rgba(225,29,72,0.15)] hover:-translate-y-1 transition-all duration-300 group" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{k.label}</div>
              <div className="text-4xl font-extrabold text-stone-900 tabular-nums tracking-tight mb-1">{k.value}</div>
              <div className="text-sm font-medium text-stone-400">{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {hasRevenueData || hasFillData || staffSeries.length > 0 || inventorySeries.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {hasSales && hasRevenueData && (
            <div className="bg-white/70 backdrop-blur-md rounded-[2rem] p-8 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">trending_up</span> Revenue Growth</h3>
              <RevenueBars data={revenueSeries} />
            </div>
          )}

          {hasAppointments && hasFillData && (
            <div className="bg-white/70 backdrop-blur-md rounded-[2rem] p-8 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">calendar_month</span> Appointment Fill Rate (Weekly)</h3>
              <FillLine data={fillSeries} />
            </div>
          )}

          {staffSeries.length > 0 && (
            <div className="bg-white/70 backdrop-blur-md rounded-[2rem] p-8 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">award_star</span> Stylist Performance</h3>
              <StaffBars data={staffSeries} valueLabel="Revenue" />
            </div>
          )}

          {inventorySeries.length > 0 && (
            <div className="bg-white/70 backdrop-blur-md rounded-[2rem] p-8 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">pie_chart</span> Inventory Distribution</h3>
              <DistributionPie data={inventorySeries} />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
          <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 mx-auto mb-5 material-symbols-outlined text-[32px]">insights</span>
          <h3 className="text-xl font-bold text-stone-900 mb-2">Not enough data yet</h3>
          <p className="text-stone-500">Add brides, orders and appointments and your charts will fill in here.</p>
        </div>
      )}
    </div>
  );
}
