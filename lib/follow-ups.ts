// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Takip listesi — SAF KOD (veritabanı erişimi yok)                        ║
// ║  Prova tepkilerini siparişlerle eşleyip "bayıldı ama almadı" gelinleri   ║
// ║  ve elbise bazında dönüşüm oranını çıkarır.                              ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/** Güçlü ilgi sayılan tepkiler. */
export const STRONG_REACTIONS = ["loved", "liked"] as const;
/** Bu puan ve üstü, tepki yazılmamış olsa da güçlü ilgi sayılır. */
export const STRONG_RATING = 4;

export type TryOnSignal = {
  customer_id: string;
  product_id: string;
  reaction: string | null;
  rating: number | null;
  created_at: Date;
};

export type OrderSignal = {
  customer_id: string;
  created_at: Date;
};

export function isStrongInterest(t: Pick<TryOnSignal, "reaction" | "rating">): boolean {
  if (t.reaction && (STRONG_REACTIONS as readonly string[]).includes(t.reaction)) return true;
  return (t.rating ?? 0) >= STRONG_RATING;
}

/** "loved" tepkisi "liked"ten önce gelir; sonra puan, sonra tazelik. */
function signalWeight(t: Pick<TryOnSignal, "reaction" | "rating">): number {
  const base = t.reaction === "loved" ? 100 : t.reaction === "liked" ? 50 : 0;
  return base + (t.rating ?? 0) * 5;
}

export type FollowUp = {
  customer_id: string;
  /** Bu gelinin güçlü ilgi gösterdiği prova sayısı. */
  signalCount: number;
  /** En güçlü sinyalin ürünü. */
  topProductId: string;
  bestReaction: string | null;
  bestRating: number | null;
  /** En son güçlü ilgi gösterdiği an. */
  lastSignalAt: Date;
  daysSince: number;
};

/**
 * Güçlü ilgi gösterip sonrasında sipariş vermeyen gelinleri döndürür.
 *
 * Sipariş "sonrasında" olmalı: provadan ÖNCE verilmiş bir sipariş, o provanın
 * takip edilmediği anlamını değiştirmez. Bu yüzden karşılaştırma tarihe göre.
 */
export function buildFollowUps(
  tryOns: TryOnSignal[],
  orders: OrderSignal[],
  now: Date = new Date()
): FollowUp[] {
  const ordersByCustomer = new Map<string, Date[]>();
  for (const o of orders) {
    const list = ordersByCustomer.get(o.customer_id) ?? [];
    list.push(o.created_at);
    ordersByCustomer.set(o.customer_id, list);
  }

  const byCustomer = new Map<string, TryOnSignal[]>();
  for (const t of tryOns) {
    if (!isStrongInterest(t)) continue;
    const list = byCustomer.get(t.customer_id) ?? [];
    list.push(t);
    byCustomer.set(t.customer_id, list);
  }

  const result: FollowUp[] = [];

  for (const [customerId, signals] of byCustomer) {
    const lastSignalAt = signals.reduce(
      (max, s) => (s.created_at > max ? s.created_at : max),
      signals[0].created_at
    );

    // Provadan sonra sipariş verdiyse takip gerekmez.
    const converted = (ordersByCustomer.get(customerId) ?? []).some(
      (orderedAt) => orderedAt >= lastSignalAt
    );
    if (converted) continue;

    const best = signals.reduce((a, b) => (signalWeight(b) > signalWeight(a) ? b : a));

    result.push({
      customer_id: customerId,
      signalCount: signals.length,
      topProductId: best.product_id,
      bestReaction: best.reaction,
      bestRating: best.rating,
      lastSignalAt,
      daysSince: Math.max(
        0,
        Math.floor((now.getTime() - lastSignalAt.getTime()) / 86_400_000)
      ),
    });
  }

  // En güçlü sinyal önce; eşitlikte en eski takip önce (en çok bekleyen).
  return result.sort((a, b) => {
    const wa = (a.bestReaction === "loved" ? 100 : 50) + (a.bestRating ?? 0) * 5;
    const wb = (b.bestReaction === "loved" ? 100 : 50) + (b.bestRating ?? 0) * 5;
    if (wb !== wa) return wb - wa;
    return a.lastSignalAt.getTime() - b.lastSignalAt.getTime();
  });
}

export type GownPerformance = {
  product_id: string;
  tryOnCount: number;
  lovedCount: number;
  /** Güçlü ilgi gösterip sipariş vermeyen gelin sayısı. */
  missedCount: number;
  /** Güçlü ilgiden siparişe dönüşüm yüzdesi; ilgi yoksa null. */
  conversionRate: number | null;
};

/**
 * Elbise bazında performans: hangi elbise çok beğeniliyor ama satmıyor?
 * Yüksek ilgi + düşük dönüşüm = fiyat, beden veya stok sorunu demektir.
 */
export function buildGownPerformance(
  tryOns: TryOnSignal[],
  orders: OrderSignal[]
): GownPerformance[] {
  const ordersByCustomer = new Map<string, Date[]>();
  for (const o of orders) {
    const list = ordersByCustomer.get(o.customer_id) ?? [];
    list.push(o.created_at);
    ordersByCustomer.set(o.customer_id, list);
  }

  const byProduct = new Map<string, { total: number; loved: number; strong: number; missed: number }>();

  for (const t of tryOns) {
    const stat = byProduct.get(t.product_id) ?? { total: 0, loved: 0, strong: 0, missed: 0 };
    stat.total += 1;
    if (t.reaction === "loved") stat.loved += 1;
    if (isStrongInterest(t)) {
      stat.strong += 1;
      const converted = (ordersByCustomer.get(t.customer_id) ?? []).some((d) => d >= t.created_at);
      if (!converted) stat.missed += 1;
    }
    byProduct.set(t.product_id, stat);
  }

  return [...byProduct.entries()]
    .map(([product_id, s]) => ({
      product_id,
      tryOnCount: s.total,
      lovedCount: s.loved,
      missedCount: s.missed,
      conversionRate: s.strong > 0 ? Math.round(((s.strong - s.missed) / s.strong) * 100) : null,
    }))
    .sort((a, b) => b.missedCount - a.missedCount || b.tryOnCount - a.tryOnCount);
}

/** Aynı geline bu süre dolmadan ikinci takip e-postası gitmez. */
export const FOLLOW_UP_COOLDOWN_DAYS = 7;

/** Bekleme süresinin başlangıcı — bu andan sonra gönderilmiş mail varsa yeni mail yok. */
export function followUpCooldownCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - FOLLOW_UP_COOLDOWN_DAYS * 86_400_000);
}

/** Son gönderim üstünden yeterli süre geçti mi? Hiç gönderilmediyse her zaman true. */
export function canSendFollowUp(lastSentAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastSentAt) return true;
  return lastSentAt < followUpCooldownCutoff(now);
}
