import Link from "next/link";
import { MODULES } from "@/config/modules";
import { RevenueChart, AppointmentChart, StatusPieChart } from "@/components/charts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function DashboardPage() {
  // DEV BYPASS: Hardcoded dummy data to bypass Supabase for UI testing
  const tenant = { name: "Elegance Bridal (Preview)", enabled_modules: ["crm", "appointments", "sales", "inventory"] as any[] };
  
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const hasSales = true;
  const hasAppointments = true;

  const stats = [
    { label: "Registered Brides", value: 142, icon: "groups", href: "/customers", module: "crm" as const },
    { label: "Upcoming Appointments", value: 12, icon: "event", href: "/appointments", module: "appointments" as const },
    { label: "Orders & Contracts", value: 89, icon: "receipt_long", href: "/orders", module: "sales" as const },
    { label: "Gowns in Inventory", value: 350, icon: "checkroom", href: "/products", module: "inventory" as const },
  ].filter((s) => tenant.enabled_modules.includes(s.module));

  // Dummy Revenue data
  const revenueData = [
    { month: "Apr", revenue: 45000 },
    { month: "May", revenue: 52000 },
    { month: "Jun", revenue: 48000 },
    { month: "Jul", revenue: 61000 },
    { month: "Aug", revenue: 59000 },
    { month: "Sep", revenue: 75000 },
  ];

  // Dummy Appointment data
  const appointmentData = [
    { day: "Mon", count: 4 },
    { day: "Tue", count: 7 },
    { day: "Wed", count: 3 },
    { day: "Thu", count: 5 },
    { day: "Fri", count: 9 },
    { day: "Sat", count: 14 },
    { day: "Sun", count: 12 },
  ];

  // Dummy Order status
  const orderStatusData = [
    { name: "In Production", value: 45 },
    { name: "Fittings", value: 20 },
    { name: "Delivered", value: 120 },
    { name: "Cancelled", value: 5 },
  ];

  return (
    <div>
      <div className="mb-10 animate-fade-in-up">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
          {greeting}, {tenant.name} <span className="text-rose-400">✧</span>
        </h1>
        <p className="text-stone-500 mt-2 font-medium">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 mb-10">
        {stats.map((stat, i) => (
          <Link key={stat.label} href={stat.href} className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-stone-200/60 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:border-rose-200 hover:shadow-[0_10px_30px_-10px_rgba(225,29,72,0.15)] hover:-translate-y-1 transition-all duration-300 group" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 material-symbols-outlined text-[24px] group-hover:bg-rose-500 group-hover:text-white transition-colors duration-300">{stat.icon}</span>
              <span className="material-symbols-outlined text-stone-300 text-xl opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 group-hover:translate-x-1 transition-all duration-300">arrow_outward</span>
            </div>
            <div className="text-4xl font-extrabold text-stone-900 tabular-nums tracking-tight">{stat.value}</div>
            <div className="text-sm font-semibold text-stone-500 mt-1 uppercase tracking-wider">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Charts */}
      {(hasSales || hasAppointments) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {hasSales && revenueData.length > 0 && (
            <div className="bg-white/70 backdrop-blur-md rounded-[2rem] p-8 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">trending_up</span> Revenue Stream</h2>
              <RevenueChart data={revenueData} />
            </div>
          )}
          {hasAppointments && appointmentData.length > 0 && (
            <div className="bg-white/70 backdrop-blur-md rounded-[2rem] p-8 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
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
      <div className="bg-white/60 backdrop-blur-md rounded-[2rem] p-8 border border-stone-200/60 shadow-sm">
        <h2 className="text-lg font-bold text-stone-900 mb-6">Active Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tenant.enabled_modules.map((moduleId) => {
            const mod = MODULES[moduleId as keyof typeof MODULES];
            if (!mod) return null;
            return (
              <Link key={moduleId} href={mod.navItems[0]?.href ?? "#"} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-stone-100 hover:border-rose-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group">
                <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-stone-50 text-stone-600 material-symbols-outlined text-[24px] group-hover:bg-rose-50 group-hover:text-rose-500 transition-colors">{mod.icon}</span>
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
