import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { uploadsEnabled } from "@/lib/uploads";
import { adjustStock } from "@/lib/actions";
import { formatPrice } from "@/config/modules";
import ModuleGuard from "@/components/module-guard";
import PageHead from "@/components/page-head";
import ProductForm from "@/components/product-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ success?: string; error?: string }> };

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ id }, sp, tenant] = await Promise.all([params, searchParams, getCurrentTenant()]);
  if (!tenant) redirect("/onboarding");

  const [product, suppliers] = await Promise.all([
    prisma.product.findFirst({
      where: { id, tenant_id: tenant.id },
      select: {
        id: true, name: true, sku: true, category: true, supplier_id: true, barcode: true,
        price: true, cost: true, stock_quantity: true, description: true, image_url: true,
      },
    }),
    prisma.supplier.findMany({ where: { tenant_id: tenant.id, is_active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!product) notFound();

  const left = product.stock_quantity;
  const margin = product.price > 0 && product.cost > 0 ? Math.round(((product.price - product.cost) / product.price) * 100) : null;
  const stepBtn = "flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-white text-[var(--ink)] transition-colors hover:border-gold hover:bg-gold-soft disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40";

  return (
    <ModuleGuard moduleId="inventory" enabledModules={tenant.enabled_modules}>
      <div className="animate-fade-in-up">
        <Link href="/products" className="mb-3 inline-block text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Stock</Link>
        <PageHead
          title={product.name}
          sub={[product.category, formatPrice(product.price), margin !== null ? `you keep ${margin}%` : null].filter(Boolean).join(" · ")}
        />

        {sp?.success === "saved" && (
          <p role="status" className="mb-6 rounded-xl border border-gold/30 bg-gold-soft px-4 py-2.5 text-sm text-[var(--ink)]">Saved.</p>
        )}
        {sp?.error && (
          <p role="alert" className="mb-6 rounded-xl border border-late/20 bg-late-soft px-4 py-2.5 text-sm text-late">
            {sp.error === "required" ? "Give it a name." : "That did not save. Try again."}
          </p>
        )}

        <section className="mb-8 flex max-w-xl items-center gap-4 rounded-2xl border border-[var(--line)] bg-white p-5">
          <div className="flex-1">
            <p className="text-sm text-[var(--muted)]">How many are left?</p>
            <p className={`font-serif text-4xl tabular-nums ${left <= 0 ? "text-late" : "text-[var(--ink)]"}`}>{left <= 0 ? "Sold out" : left}</p>
          </div>
          <form action={adjustStock}>
            <input type="hidden" name="id" value={product.id} />
            <input type="hidden" name="delta" value="-1" />
            <button type="submit" disabled={left <= 0} aria-label="One sold" title="One sold" className={stepBtn}>
              <span aria-hidden="true" className="material-symbols-outlined text-[22px]">remove</span>
            </button>
          </form>
          <form action={adjustStock}>
            <input type="hidden" name="id" value={product.id} />
            <input type="hidden" name="delta" value="1" />
            <button type="submit" aria-label="One came in" title="One came in" className={stepBtn}>
              <span aria-hidden="true" className="material-symbols-outlined text-[22px]">add</span>
            </button>
          </form>
        </section>

        <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">Details</h2>
        <ProductForm uploadsOn={uploadsEnabled()} suppliers={suppliers} product={product} />
      </div>
    </ModuleGuard>
  );
}
