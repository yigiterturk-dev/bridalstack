import { prisma } from "@/lib/prisma";

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
    data: {
      remaining_balance: Math.max(0, Number((order.discounted_total - collected).toFixed(2))),
    },
  });
}
