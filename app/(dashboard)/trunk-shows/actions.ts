"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";

export async function createTrunkShow(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const name = String(formData.get("name") || "").trim();
  const vendor = String(formData.get("vendor") || "").trim() || null;
  const start_date = String(formData.get("start_date") || "").trim();
  const end_date = String(formData.get("end_date") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!name || !start_date || !end_date) redirect("/trunk-shows?error=required");

  await prisma.trunkShow.create({
    data: { tenant_id: tenant.id, name, vendor, start_date, end_date, notes, created_by: userId },
  });
  revalidatePath("/trunk-shows");
  redirect("/trunk-shows?success=created");
}
