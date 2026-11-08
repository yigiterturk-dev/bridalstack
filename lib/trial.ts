import { PACKS, isPackSellable, type PackId } from "../config/modules.ts";

export const TRIAL_DAYS = 30;

/** Hatırlatma bu kadar gün kala gönderilir. */
const ENDING_SOON_DAYS = 3;

export type TrialGrant = {
  trialPacks: PackId[];
  trialStartedAt: Date;
  trialEndsAt: Date;
};

/**
 * Deneme, kiracının `packs` alanına YAZILMAZ.
 *
 * Ücretli paketi doğrudan `packs`'e yazmak, denemeyi bir zamanlanmış işin
 * (cron) geri almasına bağlar: iş çalışmazsa ücretli modüller süresiz bedava
 * kalır — bu üründe bir kez yaşanmış hata sınıfı. Bunun yerine deneme
 * paketleri `settings.trial_packs` içinde niyet olarak durur ve yalnızca
 * `trial_ends_at` gelecekteyken okuma anında modüllere eklenir. Süre dolunca
 * hiçbir şey çalışmadan kapanır (fail-closed).
 */
export function startTrial(
  requested: PackId[],
  now: Date,
  days: number = TRIAL_DAYS
): TrialGrant | null {
  const trialPacks = Array.from(new Set(requested)).filter(
    (p) => PACKS[p] && PACKS[p].monthlyPrice > 0 && isPackSellable(p)
  );
  if (trialPacks.length === 0) return null;

  return {
    trialPacks,
    trialStartedAt: new Date(now.getTime()),
    trialEndsAt: new Date(now.getTime() + days * 86400000),
  };
}

function endsAtMs(trialEndsAt: Date | string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt instanceof Date ? trialEndsAt.getTime() : new Date(trialEndsAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Şu an geçerli olan deneme paketleri. Süre dolduysa boş liste. */
export function activeTrialPacks(
  settings: Record<string, unknown> | null | undefined,
  trialEndsAt: Date | string | null | undefined,
  now: Date
): PackId[] {
  const ends = endsAtMs(trialEndsAt);
  // Sınır anı dolmuş sayılır: son saniyede modül açık kalmasın.
  if (ends === null || ends <= now.getTime()) return [];

  const raw = (settings ?? {})["trial_packs"];
  if (!Array.isArray(raw)) return [];

  return raw.filter(
    (p): p is PackId =>
      typeof p === "string" && Boolean(PACKS[p as PackId]) && PACKS[p as PackId].monthlyPrice > 0
  );
}

/** Kiracının sahip olduğu paketler + varsa aktif deneme paketleri. */
export function effectivePacks(
  packs: PackId[],
  settings: Record<string, unknown> | null | undefined,
  trialEndsAt: Date | string | null | undefined,
  now: Date
): PackId[] {
  const trial = activeTrialPacks(settings, trialEndsAt, now);
  const out = [...packs];
  for (const p of trial) if (!out.includes(p)) out.push(p);
  return out;
}

/** Kalan gün (yukarı yuvarlanır, eksiye inmez). Deneme yoksa null. */
export function trialDaysLeft(
  trialEndsAt: Date | string | null | undefined,
  now: Date
): number | null {
  const ends = endsAtMs(trialEndsAt);
  if (ends === null) return null;
  return Math.max(0, Math.ceil((ends - now.getTime()) / 86400000));
}

/**
 * Deneme kiracı başına bir kezdir. Ödeyen kiracı denemeye düşürülmez;
 * daha önce denemiş olan ikinci kez başlatamaz.
 */
export function canStartTrial(tenant: {
  packs: PackId[];
  plan: string;
  trial_started_at?: Date | string | null;
  converted_at?: Date | string | null;
}): boolean {
  if (tenant.trial_started_at) return false;
  if (tenant.converted_at) return false;
  if (tenant.plan !== "free") return false;
  return !(tenant.packs ?? []).some((p) => (PACKS[p]?.monthlyPrice ?? 0) > 0);
}

export type TrialReminder = "ending_soon" | "expired";

/** Hangi hatırlatmanın sırası geldi? Gönderilmiş olup olmadığını çağıran bilir. */
export function trialReminderKind(
  trialEndsAt: Date | string | null | undefined,
  now: Date
): TrialReminder | null {
  const ends = endsAtMs(trialEndsAt);
  if (ends === null) return null;
  if (ends <= now.getTime()) return "expired";
  const daysLeft = Math.ceil((ends - now.getTime()) / 86400000);
  return daysLeft <= ENDING_SOON_DAYS ? "ending_soon" : null;
}
