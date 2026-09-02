"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { buildInstallmentPlan, deriveStatus } from "@/lib/installments";
import { syncOrderBalance as recalcOrderBalance } from "@/lib/order-balance";

export async function updateOrderStatus(formData: FormData) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const member = await getCurrentMember();
  if (!hasPermission(member?.role, "orders.manage")) redirect("/orders?error=forbidden");

  const id = String(formData.get("id") || "").trim();
  const status = String(formData.get("status") || "").trim();
  if (!id || !status) return;

  await prisma.order.updateMany({ where: { id, tenant_id: tenant.id }, data: { status } });
  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
  redirect(`/orders/${id}`);
}

// ─── Taksit planı ───
// Şema, saf plan mantığı (buildInstallmentPlan), hatırlatma cron'u ve e-posta
// şablonu zaten vardı; eksik olan tek şey planı oluşturan yoldu.

const MAX_INSTALLMENTS = 60;

async function requireOrderManager(orderId: string) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const member = await getCurrentMember();
  if (!hasPermission(member?.role, "orders.manage")) redirect(`/orders/${orderId}?error=forbidden`);
  return tenant;
}

export async function createInstallmentPlan(formData: FormData) {
  const orderId = String(formData.get("order_id") || "").trim();
  if (!orderId) redirect("/orders");
  const tenant = await requireOrderManager(orderId);

  const count = parseInt(String(formData.get("count") || "0"), 10);
  const intervalMonths = parseInt(String(formData.get("interval") || "1"), 10) || 1;
  const firstDue = String(formData.get("first_due") || "").trim();
  const amountRaw = String(formData.get("amount") || "").trim();

  if (!Number.isFinite(count) || count < 1 || count > MAX_INSTALLMENTS) {
    redirect(`/orders/${orderId}?error=count`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDue)) redirect(`/orders/${orderId}?error=due_date`);

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenant.id },
    select: { id: true, customer_id: true, remaining_balance: true },
  });
  if (!order) redirect("/orders");

  // Tutar verilmezse siparişin kalan bakiyesi bölünür.
  const total = amountRaw ? parseFloat(amountRaw) : order.remaining_balance;
  if (!Number.isFinite(total) || total <= 0) redirect(`/orders/${orderId}?error=amount`);

  // Aynı sipariş için ikinci bir plan kurulmasın; önce mevcudu iptal et.
  const existing = await prisma.installment.count({
    where: { order_id: order.id, tenant_id: tenant.id, status: { not: "cancelled" } },
  });
  if (existing > 0) redirect(`/orders/${orderId}?error=plan_exists`);

  const plan = buildInstallmentPlan(total, count, firstDue, intervalMonths);

  await prisma.installment.createMany({
    data: plan.map((p) => ({
      tenant_id: tenant.id,
      order_id: order.id,
      customer_id: order.customer_id,
      installment_no: p.installment_no,
      total_count: p.total_count,
      amount: p.amount,
      due_date: p.due_date,
      status: deriveStatus({ due_date: p.due_date, paid_at: null, status: "pending" }),
    })),
  });

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}?success=plan_created`);
}

export async function markInstallmentPaid(formData: FormData) {
  const orderId = String(formData.get("order_id") || "").trim();
  const id = String(formData.get("id") || "").trim();
  if (!orderId || !id) redirect("/orders");
  const tenant = await requireOrderManager(orderId);

  // tenant_id filtresi izolasyonun garantisi — id tek başına yeterli değil.
  const updated = await prisma.installment.updateMany({
    where: { id, tenant_id: tenant.id, order_id: orderId, status: { not: "cancelled" } },
    data: { status: "paid", paid_at: new Date() },
  });

  if (updated.count > 0) await syncOrderBalance(tenant.id, orderId);

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}?success=paid`);
}

export async function markInstallmentUnpaid(formData: FormData) {
  const orderId = String(formData.get("order_id") || "").trim();
  const id = String(formData.get("id") || "").trim();
  if (!orderId || !id) redirect("/orders");
  const tenant = await requireOrderManager(orderId);

  const row = await prisma.installment.findFirst({
    where: { id, tenant_id: tenant.id, order_id: orderId },
    select: { id: true, due_date: true },
  });
  if (row) {
    await prisma.installment.update({
      where: { id: row.id },
      data: { paid_at: null, status: deriveStatus({ due_date: row.due_date, paid_at: null, status: "pending" }) },
    });
    await syncOrderBalance(tenant.id, orderId);
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}?success=unpaid`);
}

export async function cancelInstallmentPlan(formData: FormData) {
  const orderId = String(formData.get("order_id") || "").trim();
  if (!orderId) redirect("/orders");
  const tenant = await requireOrderManager(orderId);

  // Ödenmiş taksitler kayıt olarak kalır; yalnızca ödenmemişler iptal edilir.
  await prisma.installment.updateMany({
    where: { order_id: orderId, tenant_id: tenant.id, status: { notIn: ["paid", "cancelled"] } },
    data: { status: "cancelled" },
  });

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}?success=plan_cancelled`);
}

/** Ödenen taksitleri siparişin kalan bakiyesine yansıtır. */
async function syncOrderBalance(tenantId: string, orderId: string) {
  await recalcOrderBalance(tenantId, orderId);
  revalidatePath("/orders");
}
