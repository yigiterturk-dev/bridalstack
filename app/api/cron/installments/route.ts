import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail, installmentReminderEmail } from "@/lib/email";
import { deriveStatus, reminderFor, type InstallmentStatus } from "@/lib/installments";
import { formatPrice } from "@/config/modules";

export const dynamic = "force-dynamic";

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Taksit otomasyonu cron'u — CRON_SECRET korumalı, fail-closed.            ║
// ║  1) Ödenmemiş taksitlerin durumunu (pending→due→overdue) günceller.       ║
// ║  2) Vade penceresine göre hatırlatma e-postası kuyruğa alır (deduplike).  ║
// ║  Tüm kiracılar için çalışır — bilinçli olarak tenant filtresi yok.        ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const installments = await prisma.installment.findMany({
    where: { status: { in: ["pending", "due", "overdue"] } },
    select: {
      id: true, tenant_id: true, customer_id: true, amount: true, due_date: true, paid_at: true, status: true,
      customer: { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
  });

  let statusUpdated = 0;
  let remindersSent = 0;
  let emailsSent = 0;

  for (const row of installments) {
    const paidAt = row.paid_at ? row.paid_at.toISOString() : null;

    // 1) Durum geçişi
    const next = deriveStatus({ due_date: row.due_date, paid_at: paidAt, status: row.status as InstallmentStatus }, now);
    if (next !== row.status) {
      await prisma.installment.update({ where: { id: row.id }, data: { status: next } });
      statusUpdated++;
    }

    // 2) Hatırlatma kararı
    const kind = reminderFor({ due_date: row.due_date, paid_at: paidAt, status: next }, now);
    if (!kind) continue;

    // Deduplike: UNIQUE(installment_id, kind) ihlali => zaten gönderilmiş, atla.
    try {
      await prisma.installmentReminder.create({
        data: { tenant_id: row.tenant_id, installment_id: row.id, kind, channel: "email" },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
    remindersSent++;

    const customer = row.customer;
    if (customer?.email) {
      const amountStr = formatPrice(Number(row.amount || 0));
      const dueStr = new Date(row.due_date + "T12:00:00").toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
      const mail = installmentReminderEmail(customer.name, row.tenant?.name ?? "Your boutique", amountStr, dueStr, kind);
      try {
        await sendEmail({ to: customer.email, ...mail });
        emailsSent++;
      } catch (e) {
        console.error("Could not send installment reminder email:", e);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    total: installments.length,
    statusUpdated,
    remindersSent,
    emailsSent,
    stripeChargingEnabled: false,
  });
}
