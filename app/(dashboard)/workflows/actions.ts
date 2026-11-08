"use server";

import { assertModule } from "@/lib/module-access";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { boundedInt } from "@/lib/numbers";

export async function createWorkflow(formData: FormData) {
  await assertModule("commissions");
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const member = await getCurrentMember();
  if (!hasPermission(member?.role, "settings.manage")) redirect("/workflows?error=forbidden");

  const name = String(formData.get("name") || "").trim();
  const trigger_type = String(formData.get("trigger_type") || "").trim();
  const action_type = String(formData.get("action_type") || "").trim();
  const delay_minutes = boundedInt(formData.get("delay_minutes"), 0, 365 * 24 * 60, 0);

  if (!name || !trigger_type || !action_type) redirect("/workflows?error=required");

  await prisma.workflow.create({
    data: { tenant_id: tenant.id, name, trigger_type, action_type, delay_minutes, created_by: userId },
  });
  revalidatePath("/workflows");
  redirect("/workflows?success=created");
}

export async function toggleWorkflow(formData: FormData) {
  await assertModule("commissions");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const member = await getCurrentMember();
  if (!hasPermission(member?.role, "settings.manage")) redirect("/workflows?error=forbidden");
  const id = String(formData.get("id") || "").trim();
  const is_active = String(formData.get("is_active")) === "true";
  if (!id) return;
  await prisma.workflow.updateMany({ where: { id, tenant_id: tenant.id }, data: { is_active } });
  revalidatePath("/workflows");
}

export async function deleteWorkflow(formData: FormData) {
  await assertModule("commissions");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const member = await getCurrentMember();
  if (!hasPermission(member?.role, "settings.manage")) redirect("/workflows?error=forbidden");
  const id = String(formData.get("id") || "").trim();
  if (!id) return;
  await prisma.workflow.deleteMany({ where: { id, tenant_id: tenant.id } });
  revalidatePath("/workflows");
  redirect("/workflows");
}
