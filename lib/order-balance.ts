import { prisma } from "@/lib/prisma";
import { derivedOrderTotals, remainingBalance } from "@/lib/order-lines";

/**
 * Kalemleri olan siparişin toplamlarını kalemlerden yeniden yazar, sonra
 * bakiyeyi tazeler. Kalemi olmayan sipariş elle girilen toplamıyla kalır:
 * kalem özelliği açıldı diye eski siparişlerin tutarı sıfırlanmaz.
 *
 * Kalem her değiştiğinde BURASI çağrılır; toplam başka hiçbir yerde yazılmaz.
 */
export async function syncOrderTotals(tenantId: string, orderId: string) {
  const lines = await prisma.orderLine.findMany({
    where: { order_id: orderId, order: { tenant_id: tenantId } },
    select: { quantity: true, unit_price: true, discount: true },
  });

  const derived = derivedOrderTotals(lines);
  if (derived) {
    await prisma.order.updateMany({
      where: { id: orderId, tenant_id: tenantId },
      data: derived,
    });
  }

  await syncOrderBalance(tenantId, orderId);
}

/**
 * Siparişin kalan bakiyesini ödenmiş taksitlere göre yeniden hesaplar.
 * Taksit durumu nereden değişirse değişsin (sipariş sayfası, taksit sayfası,
 * cron) bakiye tek yerden güncellensin diye burada durur.
 */
export async function syncOrderBalance(tenantId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    select: { discounted_total: true, deposit_amount: true },
  });
  if (!order) return;

  const paid = await prisma.installment.aggregate({
    where: { order_id: orderId, tenant_id: tenantId, status: "paid" },
    _sum: { amount: true },
  });

  const collected = order.deposit_amount + (paid._sum.amount ?? 0);

  await prisma.order.updateMany({
    where: { id: orderId, tenant_id: tenantId },
    data: { remaining_balance: remainingBalance(order.discounted_total, collected) },
  });
}
