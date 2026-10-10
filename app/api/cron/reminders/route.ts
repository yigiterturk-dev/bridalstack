import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, appointmentReminderEmail } from "@/lib/email";
import { addCalendarDays, dateInTimeZone, normalizeTimeZone } from "@/lib/timezone";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Fetch a timezone-safe envelope, then select "tomorrow" per boutique.
  // A server-local midnight is wrong for tenants across multiple regions.
  const windowStart = new Date(now.getTime() - 86_400_000);
  const windowEnd = new Date(now.getTime() + 3 * 86_400_000);

  // Cron tüm kiracılar için çalışır — bilinçli olarak tenant filtresi yok.
  const candidates = await prisma.appointment.findMany({
    where: {
      appointment_date: { gte: windowStart, lte: windowEnd },
      status: { in: ["pending", "confirmed"] },
    },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      tenant: { select: { name: true, settings: true } },
    },
  });

  const appointments = candidates.filter((appointment) => {
    const timeZone = normalizeTimeZone((appointment.tenant?.settings as Record<string, unknown> | null)?.time_zone);
    const today = dateInTimeZone(now, timeZone);
    return dateInTimeZone(appointment.appointment_date, timeZone) === addCalendarDays(today, 1);
  });

  let sent = 0;

  for (const apt of appointments) {
    const customer = apt.customer;
    if (!customer?.email) continue;

    const timeZone = normalizeTimeZone((apt.tenant?.settings as Record<string, unknown> | null)?.time_zone);
    const dt = apt.appointment_date;
    const dateStr = dt.toLocaleDateString("en-US", { timeZone, weekday: "long", month: "long", day: "numeric" });
    const timeStr = dt.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });

    const email = appointmentReminderEmail(customer.name, apt.tenant?.name ?? "Our Shop", dateStr, timeStr);
    const delivery = await sendEmail({ to: customer.email, ...email });
    if (delivery.sent) sent++;
  }

  return NextResponse.json({ sent, total: appointments.length });
}
