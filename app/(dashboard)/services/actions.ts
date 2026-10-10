"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { boundedInt, nonNegativeFloat } from "@/lib/numbers";

// settings.manage izni gerektirir (fail-closed)
async function requireServiceManager() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const member = await getCurrentMember();
  if (!hasPermission(member?.role, "settings.manage")) redirect("/services?error=forbidden");
  return { tenant };
}

export async function createService(formData: FormData) {
  const { tenant } = await requireServiceManager();

  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim() || null;
  const duration = boundedInt(formData.get("duration"), 5, 24 * 60, 30);
  const price = nonNegativeFloat(formData.get("price"));
  const rawMax = String(formData.get("price_max") || "").trim();
  const price_max = rawMax ? nonNegativeFloat(rawMax) : null;
  const description = String(formData.get("description") || "").trim() || null;

  if (!name) redirect("/services?error=required");

  await prisma.service.create({
    data: { tenant_id: tenant.id, name, category, duration, price, price_max, description },
  });
  revalidatePath("/services");
  redirect("/services?success=created");
}

export async function deleteService(formData: FormData) {
  const { tenant } = await requireServiceManager();
  const id = String(formData.get("id") || "").trim();
  if (!id) return;
  await prisma.service.deleteMany({ where: { id, tenant_id: tenant.id } });
  revalidatePath("/services");
  redirect("/services");
}

export async function toggleService(formData: FormData) {
  const { tenant } = await requireServiceManager();
  const id = String(formData.get("id") || "").trim();
  const is_active = String(formData.get("is_active")) === "true";
  if (!id) return;
  await prisma.service.updateMany({ where: { id, tenant_id: tenant.id }, data: { is_active } });
  revalidatePath("/services");
}
