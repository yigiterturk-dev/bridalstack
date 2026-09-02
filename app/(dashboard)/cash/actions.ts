"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { CASH_METHODS, INCOME_CATEGORIES, EXPENSE_CATEGORIES, todayISO } from "@/lib/finance";

// Kasa para işidir: billing.manage (owner) gerekir — fail-closed.
async function requireFinanceManager(back: string) {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "billing.manage")) redirect(`${back}?error=forbidden`);
  return member;
}

const METHOD_IDS = CASH_METHODS.map((m) => m.id) as string[];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createMovement(formData: FormData) {
  const back = String(formData.get("back") || "/cash");
  const member = await requireFinanceManager(back);

  const direction = String(formData.get("direction") || "in") === "out" ? "out" : "in";
  const amount = Math.abs(parseFloat(String(formData.get("amount") || "0")) || 0);
  if (amount <= 0) redirect(`${back}?error=amount`);

  const method = String(formData.get("method") || "cash");
  if (!METHOD_IDS.includes(method)) redirect(`${back}?error=invalid`);

  const categories = direction === "out" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const category = String(formData.get("category") || "other");
  if (!categories.some((c) => c.id === category)) redirect(`${back}?error=invalid`);

  const occurredInput = String(formData.get("occurred_on") || "").trim();
  const occurred_on = DATE_RE.test(occurredInput) ? occurredInput : todayISO();

  // Sipariş verildiyse bu kiracıya ait olduğunu doğrula.
  const orderInput = String(formData.get("order_id") || "").trim();
  const order = orderInput
    ? await prisma.order.findFirst({
        where: { id: orderInput, tenant_id: member.tenantId },
        select: { id: true, customer_id: true },
      })
    : null;
  if (orderInput && !order) redirect(`${back}?error=invalid`);

  await prisma.cashMovement.create({
    data: {
      tenant_id: member.tenantId,
      direction,
      amount,
      method,
      category,
      occurred_on,
      description: String(formData.get("description") || "").trim() || null,
      order_id: order?.id ?? null,
      customer_id: order?.customer_id ?? null,
      created_by: member.userId,
    },
  });

  revalidatePath("/cash");
  revalidatePath("/ledger");
  redirect(`${back}?success=recorded`);
}

export async function deleteMovement(formData: FormData) {
  const back = String(formData.get("back") || "/cash");
  const member = await requireFinanceManager(back);

  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  // Taksitten veya çekten doğan kayıt elle silinmez: kaynağı geri alınca
  // kendi gider. Elle silinirse defter, tahsil edilmiş çekten kopardı.
  const row = await prisma.cashMovement.findFirst({
    where: { id, tenant_id: member.tenantId },
    select: { id: true, installment_id: true, check_id: true },
  });
  if (!row) redirect(`${back}?error=notfound`);
  if (row.installment_id || row.check_id) redirect(`${back}?error=linked`);

  await prisma.cashMovement.deleteMany({ where: { id: row.id, tenant_id: member.tenantId } });

  revalidatePath("/cash");
  revalidatePath("/ledger");
  redirect(`${back}?success=deleted`);
}
