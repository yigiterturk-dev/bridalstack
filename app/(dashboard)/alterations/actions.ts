"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { todayISO } from "@/lib/finance";
import { ALTERATION_KINDS, canTransition, kindLabel, shouldCharge } from "@/lib/alterations";

async function requireAlterationsManager() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "orders.manage")) redirect("/alterations?error=forbidden");
  return member;
}

const KIND_IDS = ALTERATION_KINDS.map((k) => k.id) as string[];

function optionalDate(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export async function createAlteration(formData: FormData) {
  const member = await requireAlterationsManager();

  const customer_id = String(formData.get("customer_id") || "").trim();
  if (!customer_id) redirect("/alterations?error=required");

  const kind = String(formData.get("kind") || "hem");
  if (!KIND_IDS.includes(kind)) redirect("/alterations?error=invalid");

  const product_id = String(formData.get("product_id") || "").trim() || null;
  const order_id = String(formData.get("order_id") || "").trim() || null;

  const [customer, product, order] = await Promise.all([
    prisma.customer.findFirst({ where: { id: customer_id, tenant_id: member.tenantId }, select: { id: true } }),
    product_id
      ? prisma.product.findFirst({ where: { id: product_id, tenant_id: member.tenantId }, select: { id: true } })
      : null,
    order_id
      ? prisma.order.findFirst({ where: { id: order_id, tenant_id: member.tenantId }, select: { id: true } })
      : null,
  ]);
  if (!customer) redirect("/alterations?error=invalid");
  if (product_id && !product) redirect("/alterations?error=invalid");
  if (order_id && !order) redirect("/alterations?error=invalid");

  await prisma.alteration.create({
    data: {
      tenant_id: member.tenantId,
      customer_id: customer.id,
      product_id: product?.id ?? null,
      order_id: order?.id ?? null,
      kind,
      fitting_date: optionalDate(formData.get("fitting_date")),
      promised_date: optionalDate(formData.get("promised_date")),
      seamstress: String(formData.get("seamstress") || "").trim() || null,
      price: Math.max(0, parseFloat(String(formData.get("price") || "0")) || 0),
      notes: String(formData.get("notes") || "").trim() || null,
      created_by: member.userId,
    },
  });

  revalidatePath("/alterations");
  redirect("/alterations?success=created");
}

/**
 * İşi bir sonraki duruma taşır.
 * Ücret kasaya yalnız TESLİMDE ve yalnız bir kez yazılır (`alteration_id`
 * tekil). Hazır ama teslim alınmamış iş para doğurmaz — gelin gelmeden
 * kasada para görünmesin.
 */
export async function updateAlterationStatus(formData: FormData) {
  const member = await requireAlterationsManager();

  const id = String(formData.get("id") || "").trim();
  const next = String(formData.get("status") || "").trim();
  if (!id || !next) return;

  const row = await prisma.alteration.findFirst({
    where: { id, tenant_id: member.tenantId },
    include: { customer: { select: { name: true } } },
  });
  if (!row) redirect("/alterations?error=notfound");
  if (!canTransition(row.status, next)) redirect("/alterations?error=transition");

  const charge = shouldCharge(next, row.price);

  await prisma.$transaction(async (tx) => {
    const moved = await tx.alteration.updateMany({
      where: { id: row.id, tenant_id: member.tenantId, status: row.status },
      data: {
        status: next,
        delivered_at: next === "delivered" ? new Date() : undefined,
      },
    });
    if (moved.count === 0) return;

    if (charge) {
      await tx.cashMovement.create({
        data: {
          tenant_id: member.tenantId,
          direction: "in",
          amount: row.price,
          method: "cash",
          category: "alteration",
          occurred_on: todayISO(),
          description: `${kindLabel(row.kind)} — ${row.customer?.name ?? "alteration"}`,
          customer_id: row.customer_id,
          order_id: row.order_id,
          alteration_id: row.id,
          created_by: member.userId,
        },
      });
    }
  });

  revalidatePath("/alterations");
  if (charge) revalidatePath("/cash");
  redirect(`/alterations?success=${next}`);
}
