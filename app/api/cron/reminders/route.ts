import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, appointmentReminderEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = new Date(tomorrow);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  // Cron tüm kiracılar için çalışır — bilinçli olarak tenant filtresi yok.
  const appointments = await prisma.appointment.findMany({
    where: {
      appointment_date: { gte: tomorrowStart, lte: tomorrowEnd },
      status: { in: ["pending", "confirmed"] },
    },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      tenant: { select: { name: true } },
    },
  });

  let sent = 0;

  for (const apt of appointments) {
    const customer = apt.customer;
    if (!customer?.email) continue;

    const dt = apt.appointment_date;
    const dateStr = dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const timeStr = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    const email = appointmentReminderEmail(customer.name, apt.tenant?.name ?? "Our Shop", dateStr, timeStr);
    await sendEmail({ to: customer.email, ...email });
    sent++;
  }

  return NextResponse.json({ sent, total: appointments.length });
}
