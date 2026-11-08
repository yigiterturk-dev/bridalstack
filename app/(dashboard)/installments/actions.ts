"use server";

import { assertModule } from "@/lib/module-access";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember, getCurrentTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { deriveStatus } from "@/lib/installments";
import { syncOrderBalance } from "@/lib/order-balance";
import { todayISO } from "@/lib/finance";
import { normalizeTimeZone } from "@/lib/timezone";

async function requireFinanceManager() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "orders.manage")) redirect("/installments?error=forbidden");
  const tenant = await getCurrentTenant();
  if (!tenant || tenant.id !== member.tenantId) redirect("/installments?error=forbidden");
  return { ...member, timeZone: normalizeTimeZone(tenant.settings.time_zone) };
}

/**
 * Taksidi tahsil edildi olarak işaretler ve kasaya bir giriş yazar.
 * Kasa kaydı taksit kimliğine bağlı (unique) — aynı taksit iki kez para
 * saymaz, tahsilat geri alınırsa kayıt da silinir.
 */
export async function payInstallment(formData: FormData) {
  await assertModule("finance");
  const member = await requireFinanceManager();
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  const row = await prisma.installment.findFirst({
    where: { id, tenant_id: member.tenantId, status: { not: "cancelled" } },
    select: { id: true, order_id: true, customer_id: true, amount: true },
  });
  if (!row) redirect("/installments?error=notfound");

  const method = String(formData.get("method") || "cash");

  await prisma.$transaction([
    prisma.installment.updateMany({
      where: { id: row.id, tenant_id: member.tenantId },
      data: { status: "paid", paid_at: new Date() },
    }),
    prisma.cashMovement.upsert({
      where: { installment_id: row.id },
      update: { amount: row.amount, method },
      create: {
        tenant_id: member.tenantId,
        direction: "in",
        amount: row.amount,
        method,
        category: "installment",
        occurred_on: todayISO(new Date(), member.timeZone),
        description: "Installment payment",
        order_id: row.order_id,
        customer_id: row.customer_id,
        installment_id: row.id,
        created_by: member.userId,
      },
    }),
  ]);

  if (row.order_id) await syncOrderBalance(member.tenantId, row.order_id);

  revalidatePath("/installments");
  revalidatePath("/cash");
  revalidatePath("/ledger");
  redirect("/installments?success=paid");
}

export async function unpayInstallment(formData: FormData) {
  await assertModule("finance");
  const member = await requireFinanceManager();
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  const row = await prisma.installment.findFirst({
    where: { id, tenant_id: member.tenantId },
    select: { id: true, order_id: true, due_date: true },
  });
  if (!row) redirect("/installments?error=notfound");

  await prisma.$transaction([
    prisma.installment.updateMany({
      where: { id: row.id, tenant_id: member.tenantId },
      data: {
        paid_at: null,
        status: deriveStatus({ due_date: row.due_date, paid_at: null, status: "pending" }),
      },
    }),
    prisma.cashMovement.deleteMany({ where: { installment_id: row.id, tenant_id: member.tenantId } }),
  ]);

  if (row.order_id) await syncOrderBalance(member.tenantId, row.order_id);

  revalidatePath("/installments");
  revalidatePath("/cash");
  revalidatePath("/ledger");
  redirect("/installments?success=unpaid");
}
