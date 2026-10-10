import { prisma } from "@/lib/prisma";
import { buildFollowUps } from "@/lib/follow-ups";
import { buildBriefing, type BriefingItem } from "@/lib/briefing";
import { deriveStatus } from "@/lib/installments";
import { addCalendarDays, dateInTimeZone, normalizeTimeZone, startOfDayInTimeZone } from "@/lib/timezone";

const LOW_STOCK_THRESHOLD = 3;

/** Kiracının bugünkü durumunu tek sorgu turunda toplayıp brifinge çevirir. */
export async function loadBriefing(tenantId: string): Promise<BriefingItem[]> {
  const now = new Date();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const timeZone = normalizeTimeZone((tenant?.settings as Record<string, unknown> | null)?.time_zone);
  const today = dateInTimeZone(now, timeZone);
  const dayStart = startOfDayInTimeZone(today, timeZone);
  const dayEnd = startOfDayInTimeZone(addCalendarDays(today, 1), timeZone);

  const [
    tryOns, orders, installments, pendingBookings,
    appointmentsToday, unconfirmedAppointments,
    products, triedProductIds, unsignedContracts,
  ] = await Promise.all([
    prisma.tryOn.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" }, take: 500,
      select: { customer_id: true, product_id: true, reaction: true, rating: true, created_at: true },
    }),
    prisma.order.findMany({
      where: { tenant_id: tenantId, status: { not: "cancelled" } },
      select: { customer_id: true, created_at: true },
    }),
    prisma.installment.findMany({
      where: { tenant_id: tenantId, status: { notIn: ["paid", "cancelled"] } },
      select: { amount: true, due_date: true, paid_at: true, status: true },
    }),
    prisma.booking.count({ where: { tenant_id: tenantId, status: "pending" } }),
    prisma.appointment.count({
      where: { tenant_id: tenantId, appointment_date: { gte: dayStart, lt: dayEnd }, status: { not: "cancelled" } },
    }),
    prisma.appointment.count({
      where: { tenant_id: tenantId, appointment_date: { gte: now }, status: "pending" },
    }),
    prisma.product.findMany({ where: { tenant_id: tenantId }, select: { id: true, price: true, stock_quantity: true } }),
    prisma.tryOn.findMany({ where: { tenant_id: tenantId }, select: { product_id: true }, distinct: ["product_id"] }),
    prisma.contract.count({ where: { tenant_id: tenantId, status: "sent" } }),
  ]);

  const followUps = buildFollowUps(tryOns, orders, now);
  const priceById = new Map(products.map((p) => [p.id, p.price]));
  const followUpValue = followUps.reduce((s, f) => s + (priceById.get(f.topProductId) ?? 0), 0);

  // Kayıtlı durum cron'a bağlı; burada tarihe göre tazeliyoruz.
  const overdue = installments.filter(
    (i) => deriveStatus({
      due_date: i.due_date,
      paid_at: i.paid_at ? i.paid_at.toISOString() : null,
      status: i.status as never,
    }, now) === "overdue"
  );

  const tried = new Set(triedProductIds.map((t) => t.product_id));

  return buildBriefing({
    followUpCount: followUps.length,
    followUpValue,
    oldestFollowUpDays: followUps.length ? Math.max(...followUps.map((f) => f.daysSince)) : null,
    overdueInstallments: overdue.length,
    overdueAmount: overdue.reduce((s, i) => s + i.amount, 0),
    pendingBookings,
    appointmentsToday,
    unconfirmedAppointments,
    outOfStock: products.filter((p) => p.stock_quantity <= 0).length,
    lowStock: products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= LOW_STOCK_THRESHOLD).length,
    deadStock: products.filter((p) => !tried.has(p.id)).length,
    unsignedContracts,
  });
}
