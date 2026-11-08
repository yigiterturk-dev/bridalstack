import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import ModuleGuard from "@/components/module-guard";
import SearchBar from "@/components/search-bar";
import { formatPrice } from "@/config/modules";
import PageHead, { BTN_PRIMARY } from "@/components/page-head";
import ListRow, { ListBox } from "@/components/list-row";
import EmptyState from "@/components/empty-state";

const LOW = 3; // Analytics'teki "running low" eşiğiyle aynı

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

  const low = list.filter((p) => p.stock_quantity <= LOW).sort((a, b) => a.stock_quantity - b.stock_quantity);
  const rest = list.filter((p) => p.stock_quantity > LOW);

  const row = (p: (typeof list)[number]) => {
    const left = p.stock_quantity;
    return (
      <ListRow
        key={p.id}
        href={`/products/${p.id}`}
        lead={
          p.image_url ? (
            <Image unoptimized src={p.image_url} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg border border-[var(--line)] object-cover" />
          ) : (
            <span aria-hidden="true" className="material-symbols-outlined flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-50 text-[20px] text-stone-400">checkroom</span>
          )
        }
        title={p.name}
        sub={[p.category, p.sku].filter(Boolean).join(" · ") || undefined}
        tone={left <= 0 ? "late" : left <= LOW ? "behind" : "none"}
        value={left <= 0 ? "Sold out" : `${left} left`}
        valueTone={left <= 0 ? "late" : "ink"}
        valueSub={formatPrice(p.price)}
      />
    );
  };

  return (
    <div className="animate-fade-in-up">
      <PageHead
        title="Stock"
        sub={count === 0 ? "Nothing on the racks yet" : `${count} ${count === 1 ? "piece" : "pieces"} · ${formatPrice(totalValue)} at selling price`}
      >
        <Link href="/products/new" className={BTN_PRIMARY}>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
          Add a piece
        </Link>
      </PageHead>

      <div className="mb-6 max-w-md">
        <SearchBar placeholder="Search by name, code or category" basePath="/products" />
      </div>

      {list.length > 0 ? (
        <div className="flex flex-col gap-6">
          {low.length > 0 && (
            <section>
              <h2 className="mb-2 font-serif text-lg text-[var(--ink)]">Running low</h2>
              <ListBox>{low.map(row)}</ListBox>
            </section>
          )}
          {rest.length > 0 && (
            <section>
              {low.length > 0 && <h2 className="mb-2 font-serif text-lg text-[var(--ink)]">Plenty left</h2>}
              <ListBox>{rest.map(row)}</ListBox>
            </section>
          )}
        </div>
      ) : (
        <EmptyState
          icon="checkroom"
          title={query ? "Nothing matches that search" : "Nothing on the racks yet"}
          action={query ? undefined : { href: "/products/new", label: "Add the first piece" }}
        >
          {query ? "Try a name, code or category." : "Add your gowns and accessories so you always know what is left."}
        </EmptyState>
      )}
    </div>
  );
}
