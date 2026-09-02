"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;

export async function listBookings() {
  const member = await getCurrentMember();
  if (!member) return [];
  const rows = await prisma.booking.findMany({
    where: { tenant_id: member.tenantId },
    orderBy: [{ booking_date: "desc" }, { start_time: "desc" }],
    select: {
      id: true, customer_name: true, customer_phone: true, customer_email: true,
      booking_date: true, start_time: true, end_time: true, status: true, notes: true, amount: true,
      service: { select: { name: true } },
      member: { select: { display_name: true } },
    },
  });
  // Şablon Supabase'in `services` / `tenant_members` adlarını bekliyor.
  return rows.map(({ service, member: m, ...b }) => ({ ...b, services: service, tenant_members: m }));
}

export async function updateBookingStatus(id: string, status: string): Promise<{ ok: boolean; error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: "Unauthorized" };
  if (!(STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid status" };
  // tenant_id filtresi: başka butiğin rezervasyonu değiştirilemez.
  const res = await prisma.booking.updateMany({ where: { id, tenant_id: member.tenantId }, data: { status } });
  return res.count ? { ok: true } : { ok: false, error: "Booking not found" };
}
