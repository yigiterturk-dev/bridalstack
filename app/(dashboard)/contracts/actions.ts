"use server";

import { assertModule } from "@/lib/module-access";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { createPublicToken } from "@/lib/tokens";
import { nonNegativeFloat } from "@/lib/numbers";

export async function createContract(formData: FormData) {
  await assertModule("sales");
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const member = await getCurrentMember();
  if (!hasPermission(member?.role, "orders.manage")) redirect("/contracts?error=forbidden");

  const customer_id = String(formData.get("customer_id") || "").trim();
  const order_id = String(formData.get("order_id") || "").trim() || null;
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const total_amount = nonNegativeFloat(formData.get("total_amount"));

  if (!customer_id || !title || !content) redirect("/contracts?error=required");

  const token = createPublicToken();

  await prisma.contract.create({
    data: {
      tenant_id: tenant.id, customer_id, order_id, title, content, total_amount,
      token, status: "sent", created_by: userId,
    },
  });

  revalidatePath("/contracts");
  redirect("/contracts?success=created");
}
