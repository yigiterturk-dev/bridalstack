"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember, getCurrentUserId } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";

export async function updateCustomer(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const member = await getCurrentMember();
  if (!hasPermission(member?.role, "customers.manage")) redirect("/customers?error=forbidden");

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const status = String(formData.get("status") || "new").trim();
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!id || !name) redirect(`/customers/${id}?error=required`);

  // tenant_id filtresi izolasyonun tek garantisi — RLS yok.
  await prisma.customer.updateMany({
    where: { id, tenant_id: tenant.id },
    data: { name, phone, email, status, notes },
  });

  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  redirect(`/customers/${id}?success=updated`);
}
