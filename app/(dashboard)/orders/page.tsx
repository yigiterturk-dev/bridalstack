import Link from "next/link";
import ModuleGuard from "@/components/module-guard";
import SearchBar from "@/components/search-bar";

type PageProps = { searchParams?: Promise<{ q?: string }> };

export default async function OrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenant = { id: "test", name: "Elegance Bridal", enabled_modules: ["crm", "appointments", "sales", "inventory"] as any[] };

  return (
    <ModuleGuard moduleId="sales" enabledModules={tenant.enabled_modules}>
      <OrdersContent tenantId={tenant.id} query={params?.q ?? ""} />
    </ModuleGuard>
  );
}

async function OrdersContent({ tenantId, query }: { tenantId: string; query: string }) {
  // DEV BYPASS: Hardcoded dummy orders
  const list = [
    { id: "1", ref_no: "ORD-2026-09A", customers: { name: "Olivia Reynolds" }, order_type: "sale", order_date: "2026-09-01T10:00:00Z", discounted_total: 4500, remaining_balance: 2250, status: "in_progress" },
    { id: "2", ref_no: "ORD-2026-09B", customers: { name: "Sophia Bennett" }, order_type: "rental", order_date: "2026-08-25T14:30:00Z", discounted_total: 1200, remaining_balance: 0, status: "confirmed" },
    { id: "3", ref_no: "ORD-2026-08C", customers: { name: "Mia Thompson" }, order_type: "sale", order_date: "2026-08-15T11:45:00Z", discounted_total: 6800, remaining_balance: 0, status: "completed" },
    { id: "4", ref_no: "ORD-2026-08D", customers: { name: "Emma Wright" }, order_type: "custom", order_date: "2026-08-05T09:15:00Z", discounted_total: 8500, remaining_balance: 4250, status: "in_progress" },
  ];
  
  const totalRevenue = list.reduce((s, o) => s + o.discounted_total, 0);

  const getStatusStyle = (status: string) => {
    switch(status) {
      case "draft": return "bg-stone-50 text-stone-600 border border-stone-200";
      case "confirmed": return "bg-blue-50 text-blue-600 border border-blue-100";
      case "in_progress": return "bg-amber-50 text-amber-600 border border-amber-100";
      case "completed": return "bg-emerald-50 text-emerald-600 border border-emerald-100";
      case "delivered": return "bg-emerald-50 text-emerald-600 border border-emerald-100";
      case "cancelled": return "bg-rose-50 text-rose-600 border border-rose-100";
      default: return "bg-stone-50 text-stone-600 border border-stone-200";
    }
  };

  const getTypeStyle = (type: string) => {
    switch(type) {
      case "sale": return "text-emerald-700 bg-emerald-50/50";
      case "rental": return "text-purple-700 bg-purple-50/50";
      case "custom": return "text-amber-700 bg-amber-50/50";
      default: return "text-stone-700 bg-stone-50/50";
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight flex items-center gap-3">
            Orders <span className="text-rose-400 font-normal">✧</span>
          </h1>
          <p className="text-stone-500 mt-2 font-medium">{list.length} active orders · ${totalRevenue.toLocaleString()} total revenue</p>
        </div>
        <div className="flex gap-3">
          <Link href="/orders/new" className="flex items-center gap-2 px-6 py-3 rounded-full bg-stone-900 text-white font-semibold text-sm hover:bg-rose-600 hover:shadow-[0_8px_20px_-6px_rgba(225,29,72,0.4)] transition-all duration-300">
            <span className="material-symbols-outlined text-[20px]">add</span>
            New Order
          </Link>
        </div>
      </div>

      <div className="mb-8 max-w-md">
        <SearchBar placeholder="Search by reference or customer..." basePath="/orders" />
      </div>

      {list.length > 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/50 border-b border-stone-100/80">
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider">Reference</th>
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider">Customer</th>
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider">Type</th>
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider">Date</th>
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Total</th>
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Balance</th>
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100/50">
                {list.map((o) => (
                  <tr key={o.id} className="hover:bg-white/80 transition-colors group">
                    <td className="px-8 py-6">
                      <Link href={`/orders/${o.id}`} className="font-mono text-sm font-bold text-stone-900 group-hover:text-rose-600 transition-colors">
                        {o.ref_no}
                      </Link>
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-stone-800">{o.customers?.name ?? "—"}</td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest ${getTypeStyle(o.order_type)}`}>
                        {o.order_type}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-sm font-medium text-stone-500">
                      {new Date(o.order_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-8 py-6 text-right text-sm font-bold text-stone-900 tabular-nums">
                      ${o.discounted_total.toLocaleString()}
                    </td>
                    <td className="px-8 py-6 text-right tabular-nums">
                      <span className={`text-sm font-bold ${o.remaining_balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        ${o.remaining_balance.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${getStatusStyle(o.status)}`}>
                        {o.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
          <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 mx-auto mb-5 material-symbols-outlined text-[32px]">receipt_long</span>
          <h3 className="text-xl font-bold text-stone-900 mb-2">No orders yet</h3>
          <p className="text-stone-500 mb-8">Create your first sale, rental, or custom order.</p>
          <Link href="/orders/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-stone-900 text-white font-semibold text-sm hover:bg-rose-600 hover:shadow-[0_8px_20px_-6px_rgba(225,29,72,0.4)] transition-all duration-300">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create Order
          </Link>
        </div>
      )}
    </div>
  );
}
