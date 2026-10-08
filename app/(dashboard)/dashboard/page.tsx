import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { MODULES, isModuleLive } from "@/config/modules";
import { buildFollowUps } from "@/lib/follow-ups";
import { RevenueChart, AppointmentChart, StatusPieChart } from "@/components/charts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Pazartesi 00:00 — haftalık randevu grafiğinin başlangıcı. */
function startOfWeek(d: Date) {
  const start = new Date(d);
  const dow = (start.getDay() + 6) % 7; // Pazartesi = 0
  start.setDate(start.getDate() - dow);
  start.setHours(0, 0, 0, 0);
  return start;
}

export default async function DashboardPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const modules = tenant.enabled_modules;
  const hasSales = modules.includes("sales");
  const hasAppointments = modules.includes("appointments");
  const hasInventory = modules.includes("inventory");
  const hasCrm = modules.includes("crm");

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Gelir grafiği son 6 ayı kapsar.
  const revenueStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [customerCount, upcomingAppointments, orderCount, productCount, weekAppointments, recentOrders, statusGroups, tryOnSignals, allOrderSignals] =
    await Promise.all([
      hasCrm ? prisma.customer.count({ where: { tenant_id: tenant.id } }) : 0,
      hasAppointments
        ? prisma.appointment.count({
            where: {
              tenant_id: tenant.id,
              appointment_date: { gte: now },
              status: { notIn: ["cancelled", "completed"] },
            },
          })
        : 0,
      hasSales ? prisma.order.count({ where: { tenant_id: tenant.id } }) : 0,
      hasInventory
        ? prisma.product.aggregate({ where: { tenant_id: tenant.id }, _sum: { stock_quantity: true } })
            .then((r) => r._sum.stock_quantity ?? 0)
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
      hasSales
        ? prisma.order.findMany({
            where: {
              tenant_id: tenant.id,
              status: { not: "cancelled" },
              created_at: { gte: revenueStart },
            },
            select: { created_at: true, discounted_total: true },
          })
        : [],
      hasSales
        ? prisma.order.groupBy({
            by: ["status"],
            where: { tenant_id: tenant.id },
            _count: { _all: true },
          })
        : [],
      hasCrm
        ? prisma.tryOn.findMany({
            where: { tenant_id: tenant.id },
            orderBy: { created_at: "desc" },
            take: 500,
            select: { customer_id: true, product_id: true, reaction: true, rating: true, created_at: true },
          })
        : [],
      hasCrm
        ? prisma.order.findMany({
            where: { tenant_id: tenant.id, status: { not: "cancelled" } },
            select: { customer_id: true, created_at: true },
          })
        : [],
    ]);

  // Bayıldığı elbiseyi almamış gelinler — en yüksek dönüşümlü takip listesi.
  const followUps = buildFollowUps(tryOnSignals, allOrderSignals);

  const stats = [
    { label: "Registered Brides", value: customerCount, icon: "groups", href: "/customers", module: "crm" as const },
    { label: "Upcoming Appointments", value: upcomingAppointments, icon: "event", href: "/appointments", module: "appointments" as const },
    { label: "Orders & Contracts", value: orderCount, icon: "receipt_long", href: "/orders", module: "sales" as const },
    { label: "Gowns in Inventory", value: productCount, icon: "checkroom", href: "/products", module: "inventory" as const },
  ].filter((s) => modules.includes(s.module));

  // Son 6 ay için ay bazlı gelir toplamı — kayıt olmayan aylar sıfır kalır.
  const revenueBuckets: { key: string; month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    revenueBuckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTHS[d.getMonth()], revenue: 0 });
  }
  for (const o of recentOrders) {
    const key = `${o.created_at.getFullYear()}-${o.created_at.getMonth()}`;
    const bucket = revenueBuckets.find((b) => b.key === key);
    if (bucket) bucket.revenue += o.discounted_total;
  }
  const revenueData = revenueBuckets.map(({ month, revenue }) => ({ month, revenue }));

  const dayCounts = new Array(7).fill(0) as number[];
  for (const a of weekAppointments) {
    dayCounts[(a.appointment_date.getDay() + 6) % 7] += 1;
  }
  const appointmentData = DAYS.map((day, i) => ({ day, count: dayCounts[i] }));

  const orderStatusData = statusGroups
    .map((g) => ({ name: STATUS_LABELS[g.status] ?? g.status.replace(/_/g, " "), value: g._count._all }))
    .filter((s) => s.value > 0);

  const hasRevenue = revenueData.some((r) => r.revenue > 0);
  const hasWeekAppointments = appointmentData.some((a) => a.count > 0);

  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
          {greeting}, {tenant.name} <span className="text-rose-400">✧</span>
        </h1>
        <p className="text-stone-500 mt-2 font-medium">
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-8">
        {stats.map((stat, i) => (
          <Link key={stat.label} href={stat.href} className="bg-white/75 backdrop-blur-md rounded-2xl p-5 border border-stone-200/70 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:border-rose-200 hover:shadow-[0_10px_30px_-10px_rgba(225,29,72,0.15)] hover:-translate-y-0.5 transition-all duration-300 group" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-50 text-rose-500 material-symbols-outlined text-[22px] group-hover:bg-rose-500 group-hover:text-white transition-colors duration-300">{stat.icon}</span>
              <span className="material-symbols-outlined text-stone-300 text-xl opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 group-hover:translate-x-1 transition-all duration-300">arrow_outward</span>
            </div>
            <div className="text-3xl font-extrabold text-stone-900 tabular-nums tracking-tight">{stat.value}</div>
            <div className="text-xs font-semibold text-stone-500 mt-1 uppercase tracking-[0.08em]">{stat.label}</div>
          </Link>
        ))}
      </div>

      {followUps.length > 0 && (
        <Link
          href="/follow-ups"
          className="group block mb-8 rounded-2xl border border-rose-200/70 bg-gradient-to-r from-rose-50/80 to-white p-5 hover:border-rose-300 hover:shadow-[0_10px_30px_-12px_rgba(225,29,72,0.25)] transition-all duration-300"
        >
          <div className="flex items-center gap-5">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-500 text-white material-symbols-outlined text-[24px] flex-shrink-0">
              notifications_active
            </span>
            <div className="min-w-0">
              <div className="font-bold text-stone-900">
                {followUps.length} {followUps.length === 1 ? "bride" : "brides"} loved a gown but have not ordered
              </div>
              <div className="text-sm text-stone-500 mt-0.5">
                The longest has been waiting {followUps[followUps.length - 1].daysSince} days. Call them back.
              </div>
            </div>
            <span className="material-symbols-outlined text-stone-300 ml-auto group-hover:text-rose-400 group-hover:translate-x-1 transition-all flex-shrink-0">
              arrow_forward
            </span>
          </div>
        </Link>
      )}

      {/* Charts */}
      {(hasRevenue || hasWeekAppointments || orderStatusData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          {hasSales && hasRevenue && (
            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-6 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">trending_up</span> Revenue Stream</h2>
              <RevenueChart data={revenueData} />
            </div>
          )}
          {hasAppointments && hasWeekAppointments && (
            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-6 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">calendar_month</span> Appointments This Week</h2>
              <AppointmentChart data={appointmentData} />
            </div>
          )}
          {hasSales && orderStatusData.length > 0 && (
            <div className="bg-white/70 backdrop-blur-md rounded-[2rem] p-8 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
              <StatusPieChart data={orderStatusData} title="Order Status" />
            </div>
          )}
        </div>
      )}

      {/* Active Modules */}
      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-stone-200/60 shadow-sm">
        <h2 className="text-lg font-bold text-stone-900 mb-6">Active Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {modules.map((moduleId) => {
            const mod = MODULES[moduleId as keyof typeof MODULES];
            // Henüz sayfası olmayan modülü kartlarda gösterme; 404'e götürür.
            if (!mod || !isModuleLive(moduleId)) return null;
            const target = mod.navItems.find((n) => !n.soon);
            if (!target) return null;
            return (
              <Link key={moduleId} href={target.href} className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-stone-100 hover:border-rose-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group">
                <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-stone-50 text-stone-600 material-symbols-outlined text-[22px] group-hover:bg-rose-50 group-hover:text-rose-500 transition-colors">{mod.icon}</span>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-stone-900 truncate">{mod.name}</div>
                  <div className="text-[13px] text-stone-500 truncate">{mod.description}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
