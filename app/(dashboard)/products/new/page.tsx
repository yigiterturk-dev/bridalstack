import { uploadsEnabled } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { redirect } from "next/navigation";
import NewProductForm from "./new-product-form";

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
  return <NewProductForm uploadsOn={uploadsEnabled()} suppliers={suppliers} />;
}
