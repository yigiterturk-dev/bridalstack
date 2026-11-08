"use server";

import { assertModule } from "@/lib/module-access";

import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";

export type ScheduleRow = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  is_off: boolean;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getBookableStaff() {
  await assertModule("booking");
  const member = await getCurrentMember();
  if (!member) return [];
  return prisma.tenantMember.findMany({
    where: { tenant_id: member.tenantId, is_bookable: true },
    select: { id: true, display_name: true, title: true },
    orderBy: { created_at: "asc" },
  });
}

export async function getSchedules(memberId: string): Promise<ScheduleRow[]> {
  await assertModule("booking");
  const member = await getCurrentMember();
  if (!member) return [];
  // Sadece kendi kiracısındaki üyenin takvimi
  return prisma.staffSchedule.findMany({
    where: { member_id: memberId, tenant_id: member.tenantId },
    select: { id: true, day_of_week: true, start_time: true, end_time: true, break_start: true, break_end: true, is_off: true },
  });
}

export async function saveSchedules(
  memberId: string,
  schedules: ScheduleRow[]
): Promise<{ ok: boolean; error?: string }> {
  await assertModule("booking");
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: "Unauthorized" };
  if (!hasPermission(member.role, "staff.manage") && member.memberId !== memberId) {
    return { ok: false, error: "Forbidden" };
  }

  const target = await prisma.tenantMember.findFirst({
    where: { id: memberId, tenant_id: member.tenantId },
    select: { id: true },
  });
  if (!target) return { ok: false, error: "Member not found" };

  const rows = (Array.isArray(schedules) ? schedules : [])
    .filter((s) => Number.isInteger(s.day_of_week) && s.day_of_week >= 0 && s.day_of_week <= 6)
    .map((s) => ({
      day_of_week: s.day_of_week,
      start_time: TIME_RE.test(s.start_time) ? s.start_time : "09:00",
      end_time: TIME_RE.test(s.end_time) ? s.end_time : "18:00",
      break_start: s.break_start && TIME_RE.test(s.break_start) ? s.break_start : null,
      break_end: s.break_end && TIME_RE.test(s.break_end) ? s.break_end : null,
      is_off: Boolean(s.is_off),
    }));

  try {
    await prisma.$transaction(
      rows.map((r) =>
        prisma.staffSchedule.upsert({
          where: { member_id_day_of_week: { member_id: memberId, day_of_week: r.day_of_week } },
          update: r,
          create: { ...r, member_id: memberId, tenant_id: member.tenantId },
        })
      )
    );
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save schedule" };
  }
}
