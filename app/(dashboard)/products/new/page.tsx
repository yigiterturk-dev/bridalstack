import { uploadsEnabled } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProductForm from "@/components/product-form";
import PageHead from "@/components/page-head";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const suppliers = await prisma.supplier.findMany({
    where: { tenant_id: tenant.id, is_active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Yükleme yapılandırılmamışsa form fotoğraf alanını devre dışı gösterir.
  return (
    <div className="animate-fade-in-up">
      <Link href="/products" className="mb-3 inline-block text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Stock</Link>
      <PageHead title="Add a piece" />
      <ProductForm uploadsOn={uploadsEnabled()} suppliers={suppliers} />
    </div>
  );
}
