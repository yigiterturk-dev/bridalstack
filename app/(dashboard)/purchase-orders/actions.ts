"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { todayISO } from "@/lib/finance";
import {
  canCancel,
  canCloseShort,
  canReceive,
  expectedFromLeadTime,
  isEditable,
  receiveDelta,
  shouldPostCost,
  statusAfterReceipt,
  summarize,
  weightedCost,
} from "@/lib/purchasing";

async function requirePurchasingManager() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "products.manage")) redirect("/purchase-orders?error=forbidden");
  return member;
}

/** Siparişi kiracıyla birlikte okur. Başka kiracının siparişi hiç bulunmaz. */
async function loadPo(tenantId: string, id: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, tenant_id: tenantId },
    include: { lines: true, supplier: { select: { name: true } } },
  });
  if (!po) redirect("/purchase-orders?error=notfound");
  return po;
}

function refNo(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO${y}${m}${d}-${rand}`;
}

export async function createPurchaseOrder(formData: FormData) {
  const member = await requirePurchasingManager();

  const supplier_id = String(formData.get("supplier_id") || "").trim();
  if (!supplier_id) redirect("/purchase-orders?error=required");

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplier_id, tenant_id: member.tenantId },
    select: { id: true, lead_time_days: true },
  });
  if (!supplier) redirect("/purchase-orders?error=invalid");

  const typed = String(formData.get("expected_on") || "").trim();
  const expected_on = /^\d{4}-\d{2}-\d{2}$/.test(typed)
    ? typed
    : expectedFromLeadTime(todayISO(), supplier.lead_time_days);

  let po;
  try {
    po = await prisma.purchaseOrder.create({
      data: {
        tenant_id: member.tenantId,
        supplier_id: supplier.id,
        ref_no: refNo(),
        expected_on,
        notes: String(formData.get("notes") || "").trim() || null,
        created_by: member.userId,
      },
    });
  } catch {
    redirect("/purchase-orders?error=insert");
  }

  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${po.id}`);
}

/** Taslağa kalem ekler. Aynı ürün ikinci kez eklenmez, adedi artar. */
export async function addLine(formData: FormData) {
  const member = await requirePurchasingManager();
  const po_id = String(formData.get("po_id") || "").trim();
  const po = await loadPo(member.tenantId, po_id);
  if (!isEditable(po.status)) redirect(`/purchase-orders/${po.id}?error=locked`);

  const product_id = String(formData.get("product_id") || "").trim();
  if (!product_id) redirect(`/purchase-orders/${po.id}?error=required`);

  const product = await prisma.product.findFirst({
    where: { id: product_id, tenant_id: member.tenantId },
    select: { id: true, cost: true },
  });
  if (!product) redirect(`/purchase-orders/${po.id}?error=invalid`);

  const ordered_qty = Math.max(1, parseInt(String(formData.get("ordered_qty") || "1"), 10) || 1);
  const rawCost = String(formData.get("unit_cost") || "").trim();
  const unit_cost = rawCost === "" ? product.cost : Math.max(0, parseFloat(rawCost) || 0);

  await prisma.purchaseOrderLine.upsert({
    where: { po_id_product_id: { po_id: po.id, product_id: product.id } },
    create: { po_id: po.id, product_id: product.id, ordered_qty, unit_cost },
    update: { ordered_qty: { increment: ordered_qty }, unit_cost },
  });

  revalidatePath(`/purchase-orders/${po.id}`);
  redirect(`/purchase-orders/${po.id}?success=line`);
}

export async function removeLine(formData: FormData) {
  const member = await requirePurchasingManager();
  const po_id = String(formData.get("po_id") || "").trim();
  const po = await loadPo(member.tenantId, po_id);
  if (!isEditable(po.status)) redirect(`/purchase-orders/${po.id}?error=locked`);

  const lineId = String(formData.get("line_id") || "").trim();
  // po_id şartı, başka siparişin kalemini silmeyi imkânsız kılar.
  await prisma.purchaseOrderLine.deleteMany({ where: { id: lineId, po_id: po.id } });

  revalidatePath(`/purchase-orders/${po.id}`);
  redirect(`/purchase-orders/${po.id}?success=removed`);
}

/** Taslağı tedarikçiye gönderir. Bu andan sonra kalemler dondurulur. */
export async function placeOrder(formData: FormData) {
  const member = await requirePurchasingManager();
  const po_id = String(formData.get("po_id") || "").trim();
  const po = await loadPo(member.tenantId, po_id);
  if (po.status !== "draft") redirect(`/purchase-orders/${po.id}?error=transition`);
  if (po.lines.length === 0) redirect(`/purchase-orders/${po.id}?error=empty`);

  await prisma.purchaseOrder.updateMany({
    where: { id: po.id, tenant_id: member.tenantId, status: "draft" },
    data: { status: "ordered", ordered_on: todayISO() },
  });

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${po.id}`);
  redirect(`/purchase-orders/${po.id}?success=ordered`);
}

/**
 * Mal kabulü. Stok BURADA ve yalnız burada artar — her kalemde yalnız aradaki
 * fark kadar. Aynı sayfa iki kez gönderilirse ikincisinde fark sıfırdır ve raf
 * ikinci kez dolmaz.
 *
 * Sipariş kalemlerden okunan duruma geçer; hepsi geldiyse kapanır ve fiilen
 * teslim alınanın bedeli bir kez kasaya yazılır (`purchase_order_id` tekil).
 */
export async function receiveLines(formData: FormData) {
  const member = await requirePurchasingManager();
  const po_id = String(formData.get("po_id") || "").trim();
  const po = await loadPo(member.tenantId, po_id);
  if (!canReceive(po.status)) redirect(`/purchase-orders/${po.id}?error=transition`);

  const asked = new Map<string, number>();
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("recv_")) continue;
    const value = String(raw).trim();
    if (value === "") continue;
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) continue;
    asked.set(key.slice(5), parsed);
  }

  const moves = po.lines
    .map((line) => ({ line, delta: receiveDelta(line, asked.get(line.id) ?? line.received_qty) }))
    .filter((m) => m.delta > 0);

  if (moves.length === 0) redirect(`/purchase-orders/${po.id}?error=nothing`);

  const nextLines = po.lines.map((line) => {
    const move = moves.find((m) => m.line.id === line.id);
    return move ? { ...line, received_qty: line.received_qty + move.delta } : line;
  });
  const nextStatus = statusAfterReceipt(nextLines);
  const closing = nextStatus === "received";
  const receivedCost = summarize(nextLines).receivedCost;

  await prisma.$transaction(async (tx) => {
    for (const { line, delta } of moves) {
      // Koşul, o an okuduğumuz adettir: iki sekme aynı anda gönderirse
      // ikincisi hiçbir şey yazmaz ve stok iki kez artmaz.
      const moved = await tx.purchaseOrderLine.updateMany({
        where: { id: line.id, po_id: po.id, received_qty: line.received_qty },
        data: { received_qty: { increment: delta } },
      });
      if (moved.count === 0) continue;

      // Maliyet, stok artmadan ÖNCEKİ hâle göre ağırlıklanır; yoksa yeni mal
      // hem paydaya hem paya iki kez girer.
      const product = await tx.product.findFirst({
        where: { id: line.product_id, tenant_id: member.tenantId },
        select: { cost: true, stock_quantity: true },
      });
      const nextCost = product
        ? weightedCost({ cost: product.cost, stock: product.stock_quantity }, delta, line.unit_cost)
        : null;

      await tx.product.updateMany({
        where: { id: line.product_id, tenant_id: member.tenantId },
        data: {
          stock_quantity: { increment: delta },
          // Birim maliyeti girilmemiş kalem ürünün maliyetini bozmaz.
          ...(nextCost === null ? {} : { cost: nextCost }),
        },
      });
    }

    await tx.purchaseOrder.updateMany({
      where: { id: po.id, tenant_id: member.tenantId, status: po.status },
      data: { status: nextStatus, closed_on: closing ? todayISO() : undefined },
    });

    if (shouldPostCost(nextStatus, nextLines)) {
      await tx.cashMovement.create({
        data: {
          tenant_id: member.tenantId,
          direction: "out",
          amount: receivedCost,
          method: "transfer",
          category: "stock",
          occurred_on: todayISO(),
          description: `${po.ref_no} — ${po.supplier?.name ?? "supplier"}`,
          purchase_order_id: po.id,
          created_by: member.userId,
        },
      });
    }
  });

  revalidatePath(`/purchase-orders/${po.id}`);
  revalidatePath("/purchase-orders");
  revalidatePath("/products");
  if (closing) revalidatePath("/cash");
  redirect(`/purchase-orders/${po.id}?success=received`);
}

/** Eksik gelen siparişi kapatır. Bedel yalnız fiilen gelen mal için yazılır. */
export async function closeShort(formData: FormData) {
  const member = await requirePurchasingManager();
  const po_id = String(formData.get("po_id") || "").trim();
  const po = await loadPo(member.tenantId, po_id);
  if (!canCloseShort(po.status, po.lines)) redirect(`/purchase-orders/${po.id}?error=transition`);

  const receivedCost = summarize(po.lines).receivedCost;

  await prisma.$transaction(async (tx) => {
    const moved = await tx.purchaseOrder.updateMany({
      where: { id: po.id, tenant_id: member.tenantId, status: po.status },
      data: { status: "received", closed_on: todayISO() },
    });
    if (moved.count === 0) return;

    if (receivedCost > 0) {
      await tx.cashMovement.create({
        data: {
          tenant_id: member.tenantId,
          direction: "out",
          amount: receivedCost,
          method: "transfer",
          category: "stock",
          occurred_on: todayISO(),
          description: `${po.ref_no} — ${po.supplier?.name ?? "supplier"} (short)`,
          purchase_order_id: po.id,
          created_by: member.userId,
        },
      });
    }
  });

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${po.id}`);
  revalidatePath("/cash");
  redirect(`/purchase-orders/${po.id}?success=closed`);
}

export async function cancelPurchaseOrder(formData: FormData) {
  const member = await requirePurchasingManager();
  const po_id = String(formData.get("po_id") || "").trim();
  const po = await loadPo(member.tenantId, po_id);
  if (!canCancel(po.status, po.lines)) redirect(`/purchase-orders/${po.id}?error=received`);

  await prisma.purchaseOrder.updateMany({
    where: { id: po.id, tenant_id: member.tenantId, status: po.status },
    data: { status: "cancelled", closed_on: todayISO() },
  });

  revalidatePath("/purchase-orders");
  redirect("/purchase-orders?success=cancelled");
}
