"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";

export async function createTrunkShow(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const member = await getCurrentMember();
  if (!hasPermission(member?.role, "appointments.manage")) redirect("/trunk-shows?error=forbidden");

  const name = String(formData.get("name") || "").trim();
  const vendor = String(formData.get("vendor") || "").trim() || null;
  const start_date = String(formData.get("start_date") || "").trim();
  const end_date = String(formData.get("end_date") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!name || !start_date || !end_date) redirect("/trunk-shows?error=required");
  if (name.length > 120 || vendor && vendor.length > 120 || notes && notes.length > 2000) {
    redirect("/trunk-shows?error=too_long");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date) || end_date < start_date) {
    redirect("/trunk-shows?error=dates");
  }

  await prisma.trunkShow.create({
    data: { tenant_id: tenant.id, name, vendor, start_date, end_date, notes, created_by: userId },
  });
  revalidatePath("/trunk-shows");
  redirect("/trunk-shows?success=created");
}
