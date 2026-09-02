import type { VercelConfig } from "@vercel/config/v1";

/**
 * Zamanlanmış işler.
 *
 * Cron uçları CRON_SECRET ile korunuyor; Vercel bu başlığı kendisi ekliyor.
 * Bu dosya olmadan uçlar var ama hiç çağrılmaz — hatırlatmalar üretimde
 * sessizce hiç gönderilmez.
 *
 * Saatler UTC. Amerika'daki bir butiğin sabahına denk gelsin diye erken
 * saatler seçildi (13:00 UTC ≈ 09:00 ET / 06:00 PT).
 *
 * NOT: Vercel Hobby planı günlük cron sayısını sınırlar. Plan yükseltilmezse
 * en değerli olanı (briefing) bırakıp diğerlerini birleştirmek gerekebilir.
 */
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    // Günlük brifing — mağaza sahibine "bugün ne yapmalı" listesi.
    { path: "/api/cron/briefing", schedule: "0 13 * * *" },
    // Yarınki randevular için müşteri hatırlatması.
    { path: "/api/cron/reminders", schedule: "0 14 * * *" },
    // Taksit durumlarını tazele ve vade hatırlatmalarını gönder.
    { path: "/api/cron/installments", schedule: "0 15 * * *" },
  ],
};

export default config;
