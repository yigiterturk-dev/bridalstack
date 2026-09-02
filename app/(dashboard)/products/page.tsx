import Link from "next/link";
import ModuleGuard from "@/components/module-guard";
import SearchBar from "@/components/search-bar";

type PageProps = { searchParams?: Promise<{ q?: string }> };

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenant = { id: "test", name: "Elegance Bridal", enabled_modules: ["crm", "appointments", "sales", "inventory"] as any[] };

  return (
    <ModuleGuard moduleId="inventory" enabledModules={tenant.enabled_modules}>
      <ProductsContent tenantId={tenant.id} query={params?.q ?? ""} />
    </ModuleGuard>
  );
}

async function ProductsContent({ tenantId, query }: { tenantId: string; query: string }) {
  // DEV BYPASS: Hardcoded dummy products
  const list = [
    { id: "1", name: "Valentina Gown", barcode: "7890123456", sku: "SKU-VAL-01", category: "Gowns", price: 2500, cost: 800, stock_quantity: 4 },
    { id: "2", name: "Pearl Embroidered Veil", barcode: "7890123457", sku: "SKU-VEIL-02", category: "Accessories", price: 450, cost: 120, stock_quantity: 12 },
    { id: "3", name: "Aria Mermaid Dress", barcode: "7890123458", sku: "SKU-ARIA-03", category: "Gowns", price: 3200, cost: 1100, stock_quantity: 2 },
    { id: "4", name: "Crystal Tiara", barcode: "7890123459", sku: "SKU-TIA-04", category: "Accessories", price: 280, cost: 65, stock_quantity: 0 },
    { id: "5", name: "Silk Crepe Minimalist", barcode: "7890123460", sku: "SKU-SILK-05", category: "Gowns", price: 1800, cost: 700, stock_quantity: 1 },
  ];
  
  const count = list.length;
  const totalValue = list.reduce((s, p) => s + (p.price * p.stock_quantity), 0);

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight flex items-center gap-3">
            Inventory <span className="text-rose-400 font-normal">✧</span>
          </h1>
          <p className="text-stone-500 mt-2 font-medium">{count} exclusive pieces · ${totalValue.toLocaleString()} total retail value</p>
        </div>
        <div className="flex gap-3">
          <Link href="/products/new" className="flex items-center gap-2 px-6 py-3 rounded-full bg-stone-900 text-white font-semibold text-sm hover:bg-rose-600 hover:shadow-[0_8px_20px_-6px_rgba(225,29,72,0.4)] transition-all duration-300">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Add to Collection
          </Link>
        </div>
      </div>

      <div className="mb-8 max-w-md">
        <SearchBar placeholder="Search by name, SKU, or category..." basePath="/products" />
      </div>

      {list.length > 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/50 border-b border-stone-100/80">
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider">Product</th>
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider">SKU</th>
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider">Category</th>
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Price</th>
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Margin</th>
                  <th className="px-8 py-5 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100/50">
                {list.map((p) => {
                  const margin = p.price > 0 && p.cost > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
                  return (
                    <tr key={p.id} className="hover:bg-white/80 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 group-hover:bg-rose-50 group-hover:text-rose-400 transition-colors">
                            <span className="material-symbols-outlined text-[24px]">checkroom</span>
                          </div>
                          <div>
                            <div className="font-bold text-stone-900 group-hover:text-rose-600 transition-colors">{p.name}</div>
                            <div className="text-[11px] text-stone-400 font-mono mt-1">{p.barcode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-sm font-medium text-stone-600">{p.sku ?? "—"}</td>
                      <td className="px-8 py-6">
                        {p.category ? (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest ${p.category === 'Gowns' ? 'bg-rose-50/80 text-rose-600' : 'bg-stone-100 text-stone-600'}`}>
                            {p.category}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-8 py-6 text-right text-sm font-bold text-stone-900 tabular-nums">
                        ${p.price.toLocaleString()}
                      </td>
                      <td className="px-8 py-6 text-right tabular-nums">
                        {margin !== null ? (
                          <span className={`text-sm font-bold ${margin >= 60 ? "text-emerald-600" : margin >= 40 ? "text-amber-600" : "text-rose-600"}`}>
                            {margin}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${p.stock_quantity <= 0 ? "bg-rose-50 text-rose-600" : "bg-stone-50 text-stone-700"}`}>
                          {p.stock_quantity}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
          <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 mx-auto mb-5 material-symbols-outlined text-[32px]">checkroom</span>
          <h3 className="text-xl font-bold text-stone-900 mb-2">No products yet</h3>
          <p className="text-stone-500 mb-8">Add your beautiful gowns and accessories to start tracking.</p>
          <Link href="/products/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-stone-900 text-white font-semibold text-sm hover:bg-rose-600 hover:shadow-[0_8px_20px_-6px_rgba(225,29,72,0.4)] transition-all duration-300">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Add to Collection
          </Link>
        </div>
      )}
    </div>
  );
}
