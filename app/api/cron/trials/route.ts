import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, trialEndingEmail, trialExpiredEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { trialDaysLeft, trialReminderKind, type TrialReminder } from "@/lib/trial";
import { PACKS, type PackId } from "@/config/modules";

/**
 * Deneme hatırlatmaları.
 *
 * Bu iş denemeyi KAPATMAZ — kapanma zamana bağlıdır (bkz. lib/trial.ts), cron
 * çalışmasa da modüller açık kalmaz. Buradaki tek görev haber vermek, o yüzden
 * hatası veri kaybına dönüşmez.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const origin = await siteUrl();

  // Cron tüm kiracılar için çalışır — bilinçli olarak tenant filtresi yok.
  const tenants = await prisma.tenant.findMany({
    where: { trial_ends_at: { not: null }, converted_at: null, plan: "free" },
    select: {
      id: true,
      name: true,
      settings: true,
      trial_ends_at: true,
      owner: { select: { email: true } },
    },
  });

  let sent = 0;

  for (const tenant of tenants) {
    const kind = trialReminderKind(tenant.trial_ends_at, now);
    if (!kind) continue;

    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const alreadySent = Array.isArray(settings.trial_notices)
      ? (settings.trial_notices as string[])
      : [];
    // Aynı hatırlatma günde bir kez çalışan iş yüzünden tekrar tekrar gitmesin.
    if (alreadySent.includes(kind)) continue;

    const packIds = Array.isArray(settings.trial_packs) ? (settings.trial_packs as PackId[]) : [];
    const packNames = packIds.map((p) => PACKS[p]?.name).filter(Boolean).join(", ");
    if (!packNames) continue;

    const email = tenant.owner?.email;
    if (!email) continue;

    const settingsUrl = `${origin}/settings`;
    const daysLeft = trialDaysLeft(tenant.trial_ends_at, now) ?? 0;
    const body =
      kind === "ending_soon"
        ? trialEndingEmail(tenant.name, packNames, Math.max(1, daysLeft), settingsUrl)
        : trialExpiredEmail(tenant.name, packNames, settingsUrl);

    const result = await sendEmail({ to: email, subject: body.subject, html: body.html });
    if (!result.sent) continue;

    // İşaret yalnız posta gerçekten gidince konur; gitmeyen hatırlatma yarın
    // yeniden denenir.
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { settings: { ...settings, trial_notices: [...alreadySent, kind as TrialReminder] } },
    });
    sent++;
  }

  return NextResponse.json({ sent, total: tenants.length });
}
