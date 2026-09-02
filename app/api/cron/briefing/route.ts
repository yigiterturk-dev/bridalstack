import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, dailyBriefingEmail } from "@/lib/email";
import { loadBriefing } from "@/app/(dashboard)/ai-stylist/briefing";

/**
 * Günlük brifing e-postası.
 *
 * Her kiracı için o günün brifingini hesaplar ve sahibine yollar. Üç kural:
 *  - hiçbir sinyal yoksa e-posta gönderilmez (boş bildirim gürültüdür)
 *  - aynı gün ikinci kez gönderilmez (briefing_sent_on ile)
 *  - kiracı kapatmışsa gönderilmez (briefing_emails)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  const baseUrl = (process.env.NEXTAUTH_URL ?? "https://bridalstack.com").replace(/\/$/, "");

  // Cron tüm kiracılar için çalışır — bilinçli olarak tenant filtresi yok.
  // NULL'a dikkat: SQL'de `NOT (kolon = 'x')` kolon NULL iken TRUE dönmez,
  // yani hiç gönderim yapılmamış kiracılar sessizce elenir. Bu yüzden
  // "hiç gönderilmedi" durumunu ayrıca yazıyoruz.
  const tenants = await prisma.tenant.findMany({
    where: {
      briefing_emails: true,
      OR: [{ briefing_sent_on: null }, { briefing_sent_on: { not: today } }],
    },
    select: { id: true, name: true, owner: { select: { email: true } } },
  });

  let sent = 0;
  let skippedEmpty = 0;
  const failures: string[] = [];

  for (const tenant of tenants) {
    const to = tenant.owner?.email;
    if (!to) continue;

    try {
      const items = await loadBriefing(tenant.id);
      if (items.length === 0) {
        skippedEmpty += 1;
        continue;
      }

      const mail = dailyBriefingEmail(tenant.name, items, baseUrl);
      await sendEmail({ to, subject: mail.subject, html: mail.html });

      // Damgayı gönderimden SONRA atıyoruz: gönderim patlarsa yarın tekrar denenir.
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { briefing_sent_on: today },
      });
      sent += 1;
    } catch (e) {
      console.error("Could not send daily briefing:", tenant.id, e);
      failures.push(tenant.id);
    }
  }

  return NextResponse.json({
    date: today,
    considered: tenants.length,
    sent,
    skippedEmpty,
    failed: failures.length,
  });
}
