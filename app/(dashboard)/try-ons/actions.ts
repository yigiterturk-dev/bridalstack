"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { boundedInt } from "@/lib/numbers";

export async function addTryOn(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const member = await getCurrentMember();
  if (!hasPermission(member?.role, "customers.manage")) redirect("/try-ons?error=forbidden");

  const customer_id = String(formData.get("customer_id") || "").trim();
  const product_id = String(formData.get("product_id") || "").trim();
  const reaction = String(formData.get("reaction") || "").trim() || null;
  const ratingInput = String(formData.get("rating") || "").trim();
  const rating = ratingInput ? boundedInt(ratingInput, 1, 5, 0) || null : null;
  const stylist = String(formData.get("stylist") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  // Sadece kendi Blob alanımızdan gelen adresler kabul edilir.
  const BLOB = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
  const photo_urls = formData
    .getAll("photo_urls")
    .map((v) => String(v).trim())
    .filter((v) => BLOB.test(v))
    .slice(0, 12);

  if (!customer_id || !product_id) redirect("/try-ons?error=required");

  // Üçü tek işlemde: yarım kalan kayıt ürünü yanlış aşamada bırakmasın.
  await prisma.$transaction([
    prisma.tryOn.create({
      data: { tenant_id: tenant.id, customer_id, product_id, reaction, rating, stylist, notes, photo_urls, created_by: userId },
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
