"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { CASH_METHODS, INCOME_CATEGORIES, EXPENSE_CATEGORIES, todayISO } from "@/lib/finance";
import {
  DRAWER_METHOD,
  canClose,
  carryOver,
  expectedClose,
  varianceMovement,
} from "@/lib/cash-session";

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

// ─── Gün açılış / kapanış sayımı ───
// Çekmecede sadece NAKİT vardır: kartla, havaleyle veya çekle geçen para hiç
// çekmeceye girmez ve gün sonu sayımına karışmaz.

/** Oturumun o günkü nakit hareketleri — beklenen tutarın dayanağı. */
async function drawerMovementsFor(tenantId: string, businessDate: string) {
  return prisma.cashMovement.findMany({
    where: { tenant_id: tenantId, occurred_on: businessDate, method: DRAWER_METHOD },
    select: { direction: true, amount: true, method: true },
  });
}

/**
 * Günü açar. Açılış parası verilmezse dünkü sayım devredilir; o da yoksa sıfır.
 * Aynı gün için ikinci oturum açılamaz — `@@unique([tenant_id, business_date])`.
 */
export async function openCashSession(formData: FormData) {
  const member = await requireFinanceManager("/cash");

  const typed = String(formData.get("business_date") || "").trim();
  const business_date = DATE_RE.test(typed) ? typed : todayISO();

  const previous = await prisma.cashSession.findFirst({
    where: { tenant_id: member.tenantId, business_date: { lt: business_date } },
    orderBy: { business_date: "desc" },
    select: { status: true, opening_float: true, counted_close: true, expected_close: true },
  });

  const rawFloat = String(formData.get("opening_float") || "").trim();
  const opening_float = rawFloat === ""
    ? carryOver(previous)
    : Math.max(0, parseFloat(rawFloat) || 0);

  try {
    await prisma.cashSession.create({
      data: {
        tenant_id: member.tenantId,
        business_date,
        opening_float,
        notes: String(formData.get("notes") || "").trim() || null,
        opened_by: member.userId,
      },
    });
  } catch {
    redirect("/cash?error=session_exists");
  }

  revalidatePath("/cash");
  redirect("/cash?success=opened");
}

/**
 * Günü kapatır.
 *
 * Beklenen tutar kapanış anında hesaplanıp **dondurulur**: o güne sonradan
 * geriye dönük bir hareket girilse bile geçmiş sayımın farkı değişmez.
 *
 * Fark isteğe bağlı olarak kasaya yazılır — eksik para gider, fazla para
 * gelirdir. Tekil anahtar (`cash_session_id`) aynı farkın iki kez yazılmasını
 * engeller. Tutar formdan gelmez, o anki veriden yeniden hesaplanır.
 */
export async function closeCashSession(formData: FormData) {
  const member = await requireFinanceManager("/cash");

  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  const session = await prisma.cashSession.findFirst({
    where: { id, tenant_id: member.tenantId },
    select: { id: true, status: true, business_date: true, opening_float: true },
  });
  if (!session) redirect("/cash?error=notfound");
  if (!canClose(session.status)) redirect("/cash?error=session_closed");

  const rawCount = String(formData.get("counted_close") || "").trim();
  if (rawCount === "") redirect("/cash?error=count");
  const counted_close = Math.max(0, parseFloat(rawCount) || 0);

  const movements = await drawerMovementsFor(member.tenantId, session.business_date);
  const expected = expectedClose(session.opening_float, movements);
  const diff = Math.round((counted_close - expected) * 100) / 100;
  const post = String(formData.get("post_variance")) === "on" ? varianceMovement(diff) : null;

  await prisma.$transaction(async (tx) => {
    // Koşul "hâlâ açık": iki sekme aynı anda kapatırsa ikincisi yazmaz.
    const moved = await tx.cashSession.updateMany({
      where: { id: session.id, tenant_id: member.tenantId, status: "open" },
      data: {
        status: "closed",
        counted_close,
        expected_close: expected,
        closed_at: new Date(),
        closed_by: member.userId,
        notes: String(formData.get("notes") || "").trim() || undefined,
      },
    });
    if (moved.count === 0) return;

    if (post) {
      await tx.cashMovement.create({
        data: {
          tenant_id: member.tenantId,
          direction: post.direction,
          amount: post.amount,
          method: DRAWER_METHOD,
          category: "other",
          occurred_on: session.business_date,
          description: `Till count ${session.business_date} — ${diff > 0 ? "over" : "short"}`,
          cash_session_id: session.id,
          created_by: member.userId,
        },
      });
    }
  });

  revalidatePath("/cash");
  revalidatePath("/ledger");
  redirect(`/cash?success=closed`);
}
