"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";

export async function createContract(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const customer_id = String(formData.get("customer_id") || "").trim();
  const order_id = String(formData.get("order_id") || "").trim() || null;
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const total_amount = parseFloat(String(formData.get("total_amount") || "0")) || 0;

  if (!customer_id || !title || !content) redirect("/contracts?error=required");

  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 20);

  await prisma.contract.create({
    data: {
      tenant_id: tenant.id, customer_id, order_id, title, content, total_amount,
      token, status: "sent", created_by: userId,
    },
  });

  revalidatePath("/contracts");
  redirect("/contracts?success=created");
}
