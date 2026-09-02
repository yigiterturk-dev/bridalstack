"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { summarizeByStaff, periodOf, UNASSIGNED, type CommissionOrder } from "@/lib/commissions";
import { LINE_KINDS } from "@/lib/order-lines";

// Prim para işidir: billing.manage (yalnız owner) gerekir.
async function requireCommissionManager(back: string) {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "billing.manage")) redirect(`${back}?error=forbidden`);
  return member;
}

/** Dönemdeki siparişlerin kalemleri — prim hesabı tür kırılımını buradan okur. */
async function loadLinesByOrder(tenantId: string, orderIds: string[]) {
  const map = new Map<string, { kind: string; quantity: number; unit_price: number; discount: number }[]>();
  if (orderIds.length === 0) return map;

  const lines = await prisma.orderLine.findMany({
    where: { order_id: { in: orderIds }, order: { tenant_id: tenantId } },
    select: { order_id: true, kind: true, quantity: true, unit_price: true, discount: true },
  });
  for (const { order_id, ...line } of lines) {
    const rows = map.get(order_id) ?? [];
    rows.push(line);
    map.set(order_id, rows);
  }
  return map;
}

export async function createRule(formData: FormData) {
  const member = await requireCommissionManager("/commissions/rules");

  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/commissions/rules?error=required");

  const scope = String(formData.get("scope") || "all") === "staff" ? "staff" : "all";
  const staff_name = String(formData.get("staff_name") || "").trim() || null;
  if (scope === "staff" && !staff_name) redirect("/commissions/rules?error=staff");

  // Kural siparişin tamamına mı, yoksa tek bir kalem türüne mi?
  const applies_to = String(formData.get("applies_to") || "order") === "kind" ? "kind" : "order";
  const rawKind = String(formData.get("line_kind") || "").trim();
  const line_kind = LINE_KINDS.some((k) => k.id === rawKind) ? rawKind : null;
  if (applies_to === "kind" && !line_kind) redirect("/commissions/rules?error=kind");

  const rate_percent = Math.min(100, Math.max(0, parseFloat(String(formData.get("rate_percent") || "0")) || 0));
  const flat_amount = Math.max(0, parseFloat(String(formData.get("flat_amount") || "0")) || 0);
  const min_order_total = Math.max(0, parseFloat(String(formData.get("min_order_total") || "0")) || 0);
  const priority = Math.max(0, parseInt(String(formData.get("priority") || "0"), 10) || 0);

  if (rate_percent === 0 && flat_amount === 0) redirect("/commissions/rules?error=empty");
  // Sabit bonus sipariş başınadır; tür kuralına verilirse her türde bir kez
  // sayılmaya çalışılır ve kullanıcı beklemediği bir tutar görür.
  if (applies_to === "kind" && rate_percent === 0) redirect("/commissions/rules?error=kindrate");

  await prisma.commissionRule.create({
    data: {
      tenant_id: member.tenantId,
      name,
      scope,
      staff_name: scope === "staff" ? staff_name : null,
      applies_to,
      line_kind: applies_to === "kind" ? line_kind : null,
      rate_percent,
      flat_amount: applies_to === "kind" ? 0 : flat_amount,
      min_order_total,
      priority,
    },
  });

  revalidatePath("/commissions/rules");
  revalidatePath("/commissions");
  redirect("/commissions/rules?success=created");
}

export async function toggleRule(formData: FormData) {
  const member = await requireCommissionManager("/commissions/rules");
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  await prisma.commissionRule.updateMany({
    where: { id, tenant_id: member.tenantId },
    data: { is_active: String(formData.get("is_active")) === "true" },
  });

  revalidatePath("/commissions/rules");
  revalidatePath("/commissions");
}

export async function deleteRule(formData: FormData) {
  const member = await requireCommissionManager("/commissions/rules");
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  await prisma.commissionRule.deleteMany({ where: { id, tenant_id: member.tenantId } });
  revalidatePath("/commissions/rules");
  revalidatePath("/commissions");
  redirect("/commissions/rules?success=deleted");
}

/**
 * Bir satışçının bir aylık primini ödenmiş olarak işaretler.
 * Tutar formdan değil, o anki veriden yeniden hesaplanır — tarayıcıdan
 * gelen rakama güvenmek primi şişirmenin en kolay yolu olurdu.
 */
export async function markPaid(formData: FormData) {
  const member = await requireCommissionManager("/commissions");

  const staff = String(formData.get("staff") || "").trim();
  const period = String(formData.get("period") || "").trim();
  if (!staff || !/^\d{4}-\d{2}$/.test(period)) redirect("/commissions?error=invalid");

  const [orders, rules] = await Promise.all([
    prisma.order.findMany({
      where: { tenant_id: member.tenantId },
      select: {
        id: true, ref_no: true, sales_person: true, status: true,
        discounted_total: true, order_date: true, created_at: true,
      },
    }),
    prisma.commissionRule.findMany({ where: { tenant_id: member.tenantId } }),
  ]);

  const inPeriod = (orders as CommissionOrder[]).filter((o) => periodOf(o) === period);
  const linesByOrder = await loadLinesByOrder(member.tenantId, inPeriod.map((o) => o.id));
  const row = summarizeByStaff(inPeriod, rules, linesByOrder).find(
    (r) => r.staff.toLowerCase() === staff.toLowerCase()
  );
  if (!row || row.commission <= 0) redirect(`/commissions?period=${period}&error=nothing`);

  await prisma.commissionPayout.upsert({
    where: {
      tenant_id_staff_name_period: { tenant_id: member.tenantId, staff_name: row.staff, period },
    },
    update: { amount: row.commission, paid_at: new Date(), paid_by: member.userId },
    create: {
      tenant_id: member.tenantId,
      staff_name: row.staff,
      period,
      amount: row.commission,
      paid_by: member.userId,
    },
  });

  revalidatePath("/commissions");
  redirect(`/commissions?period=${period}&success=paid`);
}

export async function unmarkPaid(formData: FormData) {
  const member = await requireCommissionManager("/commissions");

  const staff = String(formData.get("staff") || "").trim() || UNASSIGNED;
  const period = String(formData.get("period") || "").trim();
  if (!/^\d{4}-\d{2}$/.test(period)) redirect("/commissions?error=invalid");

  await prisma.commissionPayout.deleteMany({
    where: { tenant_id: member.tenantId, staff_name: staff, period },
  });

  revalidatePath("/commissions");
  redirect(`/commissions?period=${period}`);
}
