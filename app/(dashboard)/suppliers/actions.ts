"use server";

import { assertModule } from "@/lib/module-access";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";

// products.manage izni gerektirir (fail-closed).
async function requireInventoryManager() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "products.manage")) redirect("/suppliers?error=forbidden");
  return member;
}

function text(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) || "").trim();
  return v.length > 0 ? v : null;
}

export async function createSupplier(formData: FormData) {
  await assertModule("inventory");
  const member = await requireInventoryManager();

  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/suppliers?error=required");

  const leadRaw = String(formData.get("lead_time_days") || "").trim();
  const lead_time_days = leadRaw ? Math.max(0, parseInt(leadRaw, 10) || 0) : null;

  await prisma.supplier.create({
    data: {
      tenant_id: member.tenantId,
      name,
      contact_name: text(formData, "contact_name"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      website: text(formData, "website"),
      address: text(formData, "address"),
      payment_terms: text(formData, "payment_terms"),
      notes: text(formData, "notes"),
      lead_time_days,
    },
  });

  revalidatePath("/suppliers");
  redirect("/suppliers?success=created");
}

export async function toggleSupplier(formData: FormData) {
  await assertModule("inventory");
  const member = await requireInventoryManager();
  const id = String(formData.get("id") || "").trim();
  if (!id) return;
  const is_active = String(formData.get("is_active")) === "true";

  await prisma.supplier.updateMany({
    where: { id, tenant_id: member.tenantId },
    data: { is_active },
  });
  revalidatePath("/suppliers");
}

export async function deleteSupplier(formData: FormData) {
  await assertModule("inventory");
  const member = await requireInventoryManager();
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  // Ürünü olan tedarikçi silinmez; geçmiş kopmasın diye pasife alınır.
  const linked = await prisma.product.count({
    where: { supplier_id: id, tenant_id: member.tenantId },
  });
  if (linked > 0) {
    await prisma.supplier.updateMany({
      where: { id, tenant_id: member.tenantId },
      data: { is_active: false },
    });
    revalidatePath("/suppliers");
    redirect("/suppliers?success=deactivated");
  }

  await prisma.supplier.deleteMany({ where: { id, tenant_id: member.tenantId } });
  revalidatePath("/suppliers");
  redirect("/suppliers?success=deleted");
}
