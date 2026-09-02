"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { buildInstallmentPlan, deriveStatus } from "@/lib/installments";
import { syncOrderBalance as recalcOrderBalance, syncOrderTotals } from "@/lib/order-balance";
import { LINE_KINDS } from "@/lib/order-lines";

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

// ─── Sipariş kalemleri ───
// Toplam ekrandan gelmez: kalem her değiştiğinde syncOrderTotals siparişin
// list_total ve discounted_total alanlarını kalemlerden yeniden yazar, sonra
// bakiyeyi tazeler. Kalemi olmayan sipariş elle girilen toplamıyla kalır.

const LINE_KIND_IDS = LINE_KINDS.map((k) => k.id) as string[];

function money(value: FormDataEntryValue | null): number {
  return Math.max(0, parseFloat(String(value ?? "0")) || 0);
}

export async function addOrderLine(formData: FormData) {
  const orderId = String(formData.get("order_id") || "").trim();
  if (!orderId) redirect("/orders");
  const tenant = await requireOrderManager(orderId);

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenant.id },
    select: { id: true, status: true },
  });
  if (!order) redirect("/orders");
  if (order.status === "cancelled") redirect(`/orders/${orderId}?error=line_locked`);

  const kind = String(formData.get("kind") || "gown");
  if (!LINE_KIND_IDS.includes(kind)) redirect(`/orders/${orderId}?error=line_invalid`);

  const product_id = String(formData.get("product_id") || "").trim() || null;
  const product = product_id
    ? await prisma.product.findFirst({
        where: { id: product_id, tenant_id: tenant.id },
        select: { id: true, name: true, price: true },
      })
    : null;
  if (product_id && !product) redirect(`/orders/${orderId}?error=line_invalid`);

  // Ad ürüne bağlı olsa da kalemde saklanır: ürün silinse bile sipariş okunur kalır.
  const typedName = String(formData.get("description") || "").trim();
  const description = typedName || product?.name || "";
  if (!description) redirect(`/orders/${orderId}?error=line_required`);

  const rawPrice = String(formData.get("unit_price") || "").trim();
  const unit_price = rawPrice === "" ? (product?.price ?? 0) : money(formData.get("unit_price"));

  const last = await prisma.orderLine.findFirst({
    where: { order_id: order.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.orderLine.create({
    data: {
      order_id: order.id,
      product_id: product?.id ?? null,
      description,
      kind,
      quantity: Math.max(1, parseInt(String(formData.get("quantity") || "1"), 10) || 1),
      unit_price,
      discount: money(formData.get("discount")),
      position: (last?.position ?? 0) + 1,
      note: String(formData.get("note") || "").trim() || null,
    },
  });

  await syncOrderTotals(tenant.id, order.id);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/orders/${orderId}?success=line_added`);
}

export async function removeOrderLine(formData: FormData) {
  const orderId = String(formData.get("order_id") || "").trim();
  const lineId = String(formData.get("line_id") || "").trim();
  if (!orderId || !lineId) redirect("/orders");
  const tenant = await requireOrderManager(orderId);

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenant.id },
    select: { id: true, status: true },
  });
  if (!order) redirect("/orders");
  if (order.status === "cancelled") redirect(`/orders/${orderId}?error=line_locked`);

  // order_id şartı, başka siparişin kalemini silmeyi imkânsız kılar.
  await prisma.orderLine.deleteMany({ where: { id: lineId, order_id: order.id } });

  // Son kalem de silinirse toplam elle girilen değere DÖNMEZ; kalem yoksa
  // syncOrderTotals hiçbir şey yazmaz ve son hesaplanan tutar olduğu gibi kalır.
  await syncOrderTotals(tenant.id, order.id);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/orders/${orderId}?success=line_removed`);
}
