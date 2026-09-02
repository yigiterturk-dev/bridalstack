"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";

export async function addTryOn(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const customer_id = String(formData.get("customer_id") || "").trim();
  const product_id = String(formData.get("product_id") || "").trim();
  const reaction = String(formData.get("reaction") || "").trim() || null;
  const rating = parseInt(String(formData.get("rating") || "")) || null;
  const stylist = String(formData.get("stylist") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!customer_id || !product_id) redirect("/try-ons?error=required");

  // Üçü tek işlemde: yarım kalan kayıt ürünü yanlış aşamada bırakmasın.
  await prisma.$transaction([
    prisma.tryOn.create({
      data: { tenant_id: tenant.id, customer_id, product_id, reaction, rating, stylist, notes, created_by: userId },
    }),
    prisma.product.updateMany({
      where: { id: product_id, tenant_id: tenant.id },
      data: { lifecycle_stage: "in_fitting", lifecycle_updated_at: new Date() },
    }),
    prisma.productLifecycleLog.create({
      data: { tenant_id: tenant.id, product_id, to_stage: "in_fitting", notes: "Try-on by customer", created_by: userId },
    }),
  ]);

  revalidatePath("/try-ons");
  redirect("/try-ons?success=logged");
}
