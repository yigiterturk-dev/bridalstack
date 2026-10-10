"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember, getCurrentTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { canMoveCheck, todayISO } from "@/lib/finance";
import { finiteFloat } from "@/lib/numbers";
import { normalizeTimeZone } from "@/lib/timezone";

async function requireFinanceManager() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "billing.manage")) redirect("/checks?error=forbidden");
  const tenant = await getCurrentTenant();
  if (!tenant || tenant.id !== member.tenantId) redirect("/checks?error=forbidden");
  return { ...member, timeZone: normalizeTimeZone(tenant.settings.time_zone) };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createCheck(formData: FormData) {
  const member = await requireFinanceManager();

  const counterparty = String(formData.get("counterparty") || "").trim();
  if (!counterparty) redirect("/checks?error=required");

  const amount = Math.abs(finiteFloat(formData.get("amount")));
  if (amount <= 0) redirect("/checks?error=amount");

  const due_date = String(formData.get("due_date") || "").trim();
  if (!DATE_RE.test(due_date)) redirect("/checks?error=date");

  const direction = String(formData.get("direction") || "received") === "issued" ? "issued" : "received";

  const customerInput = String(formData.get("customer_id") || "").trim();
  const customer = customerInput
    ? await prisma.customer.findFirst({
        where: { id: customerInput, tenant_id: member.tenantId },
        select: { id: true },
      })
    : null;
  if (customerInput && !customer) redirect("/checks?error=invalid");

  await prisma.check.create({
    data: {
      tenant_id: member.tenantId,
      direction,
      counterparty,
      bank: String(formData.get("bank") || "").trim() || null,
      check_no: String(formData.get("check_no") || "").trim() || null,
      amount,
      due_date,
      customer_id: customer?.id ?? null,
      notes: String(formData.get("notes") || "").trim() || null,
      created_by: member.userId,
    },
  });

  revalidatePath("/checks");
  redirect("/checks?success=created");
}

/**
 * Çeki bir sonraki duruma taşır.
 * Tahsil edilen çek ("cleared") aynı anda kasaya girer; karşılıksız çıkarsa
 * o giriş geri alınır, böylece defterde olmayan para durmaz.
 */
export async function moveCheck(formData: FormData) {
  const member = await requireFinanceManager();

  const id = String(formData.get("id") || "").trim();
  const next = String(formData.get("status") || "").trim();
  if (!id || !next) return;

  const row = await prisma.check.findFirst({
    where: { id, tenant_id: member.tenantId },
    select: { id: true, status: true, direction: true, amount: true, counterparty: true, check_no: true },
  });
  if (!row) redirect("/checks?error=notfound");
  if (!canMoveCheck(row.status, next)) redirect("/checks?error=transition");

  const settled = next === "cleared" || next === "cancelled";

  await prisma.check.updateMany({
    where: { id: row.id, tenant_id: member.tenantId, status: row.status },
    data: { status: next, settled_at: settled ? new Date() : null },
  });

  if (next === "cleared") {
    await prisma.cashMovement.create({
      data: {
        tenant_id: member.tenantId,
        direction: row.direction === "issued" ? "out" : "in",
        amount: row.amount,
        method: "check",
        category: "other",
        occurred_on: todayISO(new Date(), member.timeZone),
        description: `Check ${row.check_no ?? ""} — ${row.counterparty}`.trim(),
        check_id: row.id,
        created_by: member.userId,
      },
    });
  }

  // Bankadan dönen çek: tahsil kaydı varsa geri al.
  if (next === "bounced") {
    await prisma.cashMovement.deleteMany({
      where: { tenant_id: member.tenantId, check_id: row.id },
    });
  }

  revalidatePath("/checks");
  revalidatePath("/cash");
  revalidatePath("/ledger");
  redirect(`/checks?success=${next}`);
}

export async function deleteCheck(formData: FormData) {
  const member = await requireFinanceManager();
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  await prisma.check.deleteMany({ where: { id, tenant_id: member.tenantId } });
  revalidatePath("/checks");
  redirect("/checks?success=deleted");
}
