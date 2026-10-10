"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import {
  canTransition,
  needsCleaningJob,
  restockUnits,
  RETURN_REASONS,
  RETURN_CONDITIONS,
} from "@/lib/inventory";
import { nonNegativeFloat } from "@/lib/numbers";

async function requireReturnsManager() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "orders.manage")) redirect("/returns?error=forbidden");
  return member;
}

const REASON_IDS = RETURN_REASONS.map((r) => r.id) as string[];
const CONDITION_IDS = RETURN_CONDITIONS.map((c) => c.id) as string[];

export async function createReturn(formData: FormData) {
  const member = await requireReturnsManager();

  const customer_id = String(formData.get("customer_id") || "").trim() || null;
  const product_id = String(formData.get("product_id") || "").trim() || null;
  const order_id = String(formData.get("order_id") || "").trim() || null;

  if (!customer_id && !product_id) redirect("/returns?error=required");

  const reason = String(formData.get("reason") || "other");
  const condition = String(formData.get("condition") || "resellable");
  if (!REASON_IDS.includes(reason) || !CONDITION_IDS.includes(condition)) {
    redirect("/returns?error=invalid");
  }

  const quantity = Math.max(1, parseInt(String(formData.get("quantity") || "1"), 10) || 1);
  const refund_amount = nonNegativeFloat(formData.get("refund_amount"));

  // Referans verilen kayıtlar gerçekten bu kiracıya mı ait? RLS yok.
  const [customer, product, order] = await Promise.all([
    customer_id
      ? prisma.customer.findFirst({ where: { id: customer_id, tenant_id: member.tenantId }, select: { id: true } })
      : null,
    product_id
      ? prisma.product.findFirst({ where: { id: product_id, tenant_id: member.tenantId }, select: { id: true } })
      : null,
    order_id
      ? prisma.order.findFirst({ where: { id: order_id, tenant_id: member.tenantId }, select: { id: true } })
      : null,
  ]);
  if (customer_id && !customer) redirect("/returns?error=invalid");
  if (product_id && !product) redirect("/returns?error=invalid");
  if (order_id && !order) redirect("/returns?error=invalid");

  await prisma.productReturn.create({
    data: {
      tenant_id: member.tenantId,
      customer_id: customer?.id ?? null,
      product_id: product?.id ?? null,
      order_id: order?.id ?? null,
      quantity,
      reason,
      condition,
      refund_amount,
      restock: String(formData.get("restock")) === "on",
      notes: String(formData.get("notes") || "").trim() || null,
      created_by: member.userId,
    },
  });

  revalidatePath("/returns");
  redirect("/returns?success=created");
}

/**
 * İadeyi bir sonraki duruma taşır.
 * "completed" adımında — ve sadece orada — mal fiilen stoğa geri girer;
 * böylece onaylanmış ama gelin getirmemiş iade stoğu şişirmez.
 */
export async function updateReturnStatus(formData: FormData) {
  const member = await requireReturnsManager();

  const id = String(formData.get("id") || "").trim();
  const next = String(formData.get("status") || "").trim();
  if (!id || !next) return;

  const record = await prisma.productReturn.findFirst({
    where: { id, tenant_id: member.tenantId },
    select: {
      id: true,
      status: true,
      product_id: true,
      customer_id: true,
      quantity: true,
      condition: true,
      restock: true,
    },
  });
  if (!record) redirect("/returns?error=notfound");
  if (!canTransition(record.status, next)) redirect("/returns?error=transition");

  const units = next === "completed" ? restockUnits(record) : 0;
  // Kirli gelen elbise rafa değil temizlemeye gider; rafa oradan girer.
  const toCleaning = next === "completed" && needsCleaningJob(record);

  await prisma.$transaction(async (tx) => {
    const moved = await tx.productReturn.updateMany({
      where: { id: record.id, tenant_id: member.tenantId, status: record.status },
      data: {
        status: next,
        processed_at: next === "pending" ? null : new Date(),
      },
    });
    if (moved.count === 0) return;

    if (units > 0 && record.product_id) {
      await tx.product.updateMany({
        where: { id: record.product_id, tenant_id: member.tenantId },
        data: { stock_quantity: { increment: units } },
      });
    }

    if (toCleaning) {
      await tx.cleaningJob.create({
        data: {
          tenant_id: member.tenantId,
          product_id: record.product_id,
          customer_id: record.customer_id,
          source: "return",
          return_id: record.id,
          quantity: record.quantity,
          notes: "Came back dirty on a return",
          created_by: member.userId,
        },
      });
    }
  });

  revalidatePath("/returns");
  if (units > 0) revalidatePath("/products");
  if (toCleaning) revalidatePath("/cleaning");
  redirect(`/returns?success=${next}`);
}
