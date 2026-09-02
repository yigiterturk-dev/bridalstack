import { RevenueBars, FillLine, StaffBars, DistributionPie } from "@/components/analytics-charts";
import RangeFilter from "./range-filter";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ range?: string }> };

export default async function AnalyticsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rangeDays = Math.min(365, Math.max(7, parseInt(sp.range ?? "30") || 30));
  
  const tenantName = "Elegance Bridal";

  // DEV BYPASS: Hardcoded dummy analytics data
  const hasSales = true;
  const hasAppointments = true;
  const hasInventory = true;
  const hasBooking = true;

  const totalRevenue = 124500;
  const bookingRevenue = 15200;
  const apptTotal = 142;
  const apptDone = 118;
  const fillRate = 83;
  const stockValue = 425000;
  const lowStock = 3;

  const revenueSeries = [
    { label: "Apr", value: 18000 },
    { label: "May", value: 24000 },
    { label: "Jun", value: 21000 },
    { label: "Jul", value: 35000 },
    { label: "Aug", value: 31000 },
    { label: "Sep", value: 42000 },
  ];

  const fillSeries = [
    { label: "Mon", booked: 5, capacity: 8 },
    { label: "Tue", booked: 7, capacity: 8 },
    { label: "Wed", booked: 4, capacity: 8 },
    { label: "Thu", booked: 6, capacity: 8 },
    { label: "Fri", booked: 10, capacity: 12 },
    { label: "Sat", booked: 14, capacity: 15 },
    { label: "Sun", booked: 12, capacity: 12 },
  ];

  const staffSeries = [
    { label: "Isabella (Senior Stylist)", value: 45000 },
    { label: "Emma (Stylist)", value: 32000 },
    { label: "Olivia (Junior Stylist)", value: 18000 },
  ];

  const inventorySeries = [
    { name: "Bridal Gowns", value: 65 },
    { name: "Veils", value: 20 },
    { name: "Accessories", value: 10 },
    { name: "Shoes", value: 5 },
  ];

  const kpis = [
    { label: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, sub: "from orders" },
    { label: "Styling Fees", value: `$${bookingRevenue.toLocaleString()}`, sub: "completed bookings" },
    { label: "Calendar Fill Rate", value: `${fillRate}%`, sub: `${apptDone}/${apptTotal} appointments` },
    { label: "Inventory Value", value: `$${stockValue.toLocaleString()}`, sub: `${lowStock} low stock items` },
  ];

  return (
    <div className="animate-fade-in-up space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight flex items-center gap-3">
            Analytics <span className="text-rose-400 font-normal">✧</span>
          </h1>
          <p className="text-stone-500 mt-2 font-medium">{tenantName} — business performance</p>
        </div>
        <div>
          <RangeFilter current={String(rangeDays)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {kpis.map((k, i) => (
          <div key={k.label} className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-stone-200/60 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:border-rose-200 hover:shadow-[0_10px_30px_-10px_rgba(225,29,72,0.15)] hover:-translate-y-1 transition-all duration-300 group" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{k.label}</div>
            <div className="text-4xl font-extrabold text-stone-900 tabular-nums tracking-tight mb-1">{k.value}</div>
            <div className="text-sm font-medium text-stone-400">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/70 backdrop-blur-md rounded-[2rem] p-8 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">trending_up</span> Revenue Growth</h3>
          <RevenueBars data={revenueSeries} />
        </div>
        
        <div className="bg-white/70 backdrop-blur-md rounded-[2rem] p-8 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">calendar_month</span> Appointment Fill Rate (Weekly)</h3>
          <FillLine data={fillSeries} />
        </div>

        <div className="bg-white/70 backdrop-blur-md rounded-[2rem] p-8 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">award_star</span> Stylist Performance</h3>
          <StaffBars data={staffSeries} />
        </div>

        <div className="bg-white/70 backdrop-blur-md rounded-[2rem] p-8 border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">pie_chart</span> Inventory Distribution</h3>
          <DistributionPie data={inventorySeries} />
        </div>
      </div>
    </div>
  );
}
