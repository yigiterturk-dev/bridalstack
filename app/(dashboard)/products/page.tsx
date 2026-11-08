import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import ModuleGuard from "@/components/module-guard";
import SearchBar from "@/components/search-bar";
import { formatPrice } from "@/config/modules";

type PageProps = { searchParams?: Promise<{ q?: string }> };

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="inventory" enabledModules={tenant.enabled_modules}>
      <ProductsContent tenantId={tenant.id} query={params?.q?.trim() ?? ""} />
    </ModuleGuard>
  );
}

async function ProductsContent({ tenantId, query }: { tenantId: string; query: string }) {
  const where = {
    tenant_id: tenantId,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { sku: { contains: query, mode: "insensitive" as const } },
            { category: { contains: query, mode: "insensitive" as const } },
            { barcode: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [list, totals] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 200,
      select: {
        id: true, name: true, barcode: true, sku: true, category: true,
        price: true, cost: true, stock_quantity: true, image_url: true,
      },
    }),
    prisma.product.findMany({
      where: { tenant_id: tenantId },
      select: { price: true, stock_quantity: true },
    }),
  ]);

  const count = totals.length;
  const totalValue = totals.reduce((s, p) => s + p.price * p.stock_quantity, 0);

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-serif font-normal text-[var(--ink)] flex items-center gap-3">
            Inventory
          </h1>
          <p className="text-[var(--muted)] mt-2 font-medium">
            {count === 0
              ? "No pieces in the collection yet"
              : `${count} exclusive ${count === 1 ? "piece" : "pieces"} · ${formatPrice(totalValue)} total retail value`}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/products/new" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-stone-900 text-white font-medium text-sm hover:bg-gold transition-all duration-300">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Add to Collection
          </Link>
        </div>
      </div>

      <div className="mb-8 max-w-md">
        <SearchBar placeholder="Search by name, SKU, or category..." basePath="/products" />
      </div>

      {list.length > 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--line)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/50 border-b border-[var(--line)]">
                  <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Product</th>
                  <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider">SKU</th>
                  <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Category</th>
                  <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider text-right">Price</th>
                  <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider text-right">Margin</th>
                  <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {list.map((p) => {
                  const margin = p.price > 0 && p.cost > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
                  return (
                    <tr key={p.id} className="hover:bg-stone-50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          {p.image_url ? (
                            <Image
                              unoptimized
                              src={p.image_url}
                              alt={p.name}
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded-2xl object-cover border border-stone-200"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 group-hover:bg-gold-soft group-hover:text-gold transition-colors">
                              <span className="material-symbols-outlined text-[24px]">checkroom</span>
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-[var(--ink)] group-hover:text-gold transition-colors">{p.name}</div>
                            <div className="text-[11px] text-stone-400 font-mono mt-1">{p.barcode ?? ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-sm font-medium text-stone-600">{p.sku ?? "—"}</td>
                      <td className="px-8 py-6">
                        {p.category ? (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest ${p.category.toLowerCase() === "gowns" ? "bg-gold-soft text-gold" : "bg-stone-100 text-stone-600"}`}>
                            {p.category}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-8 py-6 text-right text-sm font-bold text-[var(--ink)] tabular-nums">
                        {formatPrice(p.price)}
                      </td>
                      <td className="px-8 py-6 text-right tabular-nums">
                        {margin !== null ? (
                          <span className={`text-sm font-bold ${margin >= 60 ? "text-emerald-600" : margin >= 40 ? "text-amber-600" : "text-gold"}`}>
                            {margin}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${p.stock_quantity <= 0 ? "bg-gold-soft text-gold" : "bg-stone-50 text-stone-700"}`}>
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
        <div className="bg-white rounded-2xl border border-[var(--line)] shadow-sm p-16 text-center">
          <span className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gold-soft text-gold mx-auto mb-5 material-symbols-outlined text-[32px]">checkroom</span>
          <h3 className="text-xl font-bold text-[var(--ink)] mb-2">{query ? "No results found" : "No products yet"}</h3>
          <p className="text-[var(--muted)] mb-8">{query ? "Try a different search term." : "Add your beautiful gowns and accessories to start tracking."}</p>
          {!query && (
            <Link href="/products/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-stone-900 text-white font-medium text-sm hover:bg-gold transition-all duration-300">
              <span className="material-symbols-outlined text-[20px]">add</span>
              Add to Collection
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
