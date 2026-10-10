"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember, getCurrentTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { todayISO } from "@/lib/finance";
import {
  canTransition,
  intakeStockDelta,
  outcomeStockDelta,
  shouldPostCost,
} from "@/lib/cleaning";
import { nonNegativeFloat } from "@/lib/numbers";
import { normalizeTimeZone } from "@/lib/timezone";

async function requireCleaningManager() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "products.manage")) redirect("/cleaning?error=forbidden");
  const tenant = await getCurrentTenant();
  if (!tenant || tenant.id !== member.tenantId) redirect("/cleaning?error=forbidden");
  return { ...member, timeZone: normalizeTimeZone(tenant.settings.time_zone) };
}

/**
 * Elle temizleme işi açar. Ekrandan açılan iş her zaman raftaki maldır —
 * iadeden ve kiradan gelenler kendi akışlarında otomatik doğar, orada mal
 * zaten raftan çıkmıştır. İkinci kez düşersek stok eksiye kayar.
 */
export async function createCleaningJob(formData: FormData) {
  const member = await requireCleaningManager();

  const product_id = String(formData.get("product_id") || "").trim();
  if (!product_id) redirect("/cleaning?error=required");

  const source = "stock";

  const quantity = Math.max(1, parseInt(String(formData.get("quantity") || "1"), 10) || 1);

  const product = await prisma.product.findFirst({
    where: { id: product_id, tenant_id: member.tenantId },
    select: { id: true, stock_quantity: true },
  });
  if (!product) redirect("/cleaning?error=invalid");

  // Rafta olmayan malı temizlemeye gönderemeyiz; stok eksiye düşmesin.
  if (product.stock_quantity < quantity) redirect("/cleaning?error=nostock");

  const delta = intakeStockDelta(source, quantity);

  await prisma.$transaction(async (tx) => {
    if (delta !== 0) {
      // Koşullu güncelleme: iki sekme aynı anda gönderirse ikincisi stoğu
      // eksiye düşüremez.
      const moved = await tx.product.updateMany({
        where: { id: product.id, tenant_id: member.tenantId, stock_quantity: { gte: quantity } },
        data: { stock_quantity: { increment: delta } },
      });
      if (moved.count === 0) return;
    }

    await tx.cleaningJob.create({
      data: {
        tenant_id: member.tenantId,
        product_id: product.id,
        source,
        quantity,
        vendor: String(formData.get("vendor") || "").trim() || null,
        expected_on: String(formData.get("expected_on") || "").trim() || null,
        cost: nonNegativeFloat(formData.get("cost")),
        notes: String(formData.get("notes") || "").trim() || null,
        created_by: member.userId,
      },
    });
  });

  revalidatePath("/cleaning");
  revalidatePath("/products");
  redirect("/cleaning?success=created");
}

/**
 * İşi bir sonraki duruma taşır.
 * Mal rafa yalnız "returned" adımında, yalnız bir kez girer — kaynağı ne
 * olursa olsun. Hurdaya ayrılan mal hiç dönmez.
 * Temizleme gideri kasaya yalnız iş kapanınca yazılır (`cleaning_job_id` tekil).
 */
export async function updateCleaningStatus(formData: FormData) {
  const member = await requireCleaningManager();

  const id = String(formData.get("id") || "").trim();
  const next = String(formData.get("status") || "").trim();
  if (!id || !next) return;

  const row = await prisma.cleaningJob.findFirst({
    where: { id, tenant_id: member.tenantId },
    include: { product: { select: { name: true } } },
  });
  if (!row) redirect("/cleaning?error=notfound");
  if (!canTransition(row.status, next)) redirect("/cleaning?error=transition");

  const today = todayISO(new Date(), member.timeZone);
  const units = outcomeStockDelta(next, row.quantity);

  await prisma.$transaction(async (tx) => {
    const moved = await tx.cleaningJob.updateMany({
      where: { id: row.id, tenant_id: member.tenantId, status: row.status },
      data: {
        status: next,
        sent_on: next === "sent" ? today : undefined,
        returned_on: next === "returned" ? today : undefined,
      },
    });
    if (moved.count === 0) return;

    if (units > 0 && row.product_id) {
      await tx.product.updateMany({
        where: { id: row.product_id, tenant_id: member.tenantId },
        data: { stock_quantity: { increment: units } },
      });
    }

    if (shouldPostCost(next, row.cost)) {
      await tx.cashMovement.create({
        data: {
          tenant_id: member.tenantId,
          direction: "out",
          amount: row.cost,
          method: "cash",
          category: "cleaning",
          occurred_on: today,
          description: `Cleaning — ${row.product?.name ?? "gown"}${row.vendor ? ` · ${row.vendor}` : ""}`,
          cleaning_job_id: row.id,
          created_by: member.userId,
        },
      });
    }
  });

  revalidatePath("/cleaning");
  if (units > 0) revalidatePath("/products");
  if (shouldPostCost(next, row.cost)) revalidatePath("/cash");
  redirect(`/cleaning?success=${next}`);
}
