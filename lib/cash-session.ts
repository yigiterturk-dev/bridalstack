// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Kasa oturumu — SAF KOD (veritabanı erişimi yok)                         ║
// ║                                                                          ║
// ║  Tek değişmez: ÇEKMECEDE SADECE NAKİT VARDIR. Kartla, havaleyle veya     ║
// ║  çekle geçen para hiç çekmeceye girmez; gün sonu sayımına da karışmaz.   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/** Fiilen çekmeceye giren/çıkan ödeme yöntemi. Diğerleri bankada döner. */
export const DRAWER_METHOD = "cash";

export const SESSION_STATUSES = ["open", "closed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export type DrawerMovement = {
  direction: string; // in | out
  amount: number;
  method: string;
};

/** Hareket çekmeceyi etkiler mi? Yalnız nakit. */
export function touchesDrawer(m: DrawerMovement): boolean {
  return m.method === DRAWER_METHOD;
}

/**
 * Hareketlerin çekmeceye net etkisi.
 * Kart, havale ve çek hareketleri sayılmaz — o para hiç çekmeceye girmedi.
 */
export function drawerNet(movements: DrawerMovement[]): number {
  let net = 0;
  for (const m of movements) {
    if (!touchesDrawer(m)) continue;
    net += m.direction === "out" ? -Math.abs(m.amount) : Math.abs(m.amount);
  }
  return Math.round(net * 100) / 100;
}

/** Gün sonunda çekmecede olması gereken tutar. */
export function expectedClose(openingFloat: number, movements: DrawerMovement[]): number {
  return Math.round((openingFloat + drawerNet(movements)) * 100) / 100;
}

export type SessionRow = {
  status: string;
  opening_float: number;
  counted_close?: number | null;
  expected_close?: number | null;
};

/**
 * Bir oturumun beklenen tutarı.
 * Kapanmış oturumda **dondurulmuş** değer okunur: o güne sonradan geriye dönük
 * hareket girilse bile geçmiş sayımın farkı değişmez. Açık oturumda tutar
 * anlık hareketlerden hesaplanır.
 */
export function expectedFor(session: SessionRow, movements: DrawerMovement[]): number {
  if (session.status === "closed" && session.expected_close !== null && session.expected_close !== undefined) {
    return session.expected_close;
  }
  return expectedClose(session.opening_float, movements);
}

/**
 * Sayım farkı: sayılan − beklenen.
 * Artı = kasada fazla, eksi = kasada eksik. Sayılmamışsa null.
 */
export function variance(session: SessionRow, movements: DrawerMovement[]): number | null {
  if (session.counted_close === null || session.counted_close === undefined) return null;
  return Math.round((session.counted_close - expectedFor(session, movements)) * 100) / 100;
}

export type VarianceVerdict = "exact" | "over" | "short" | "uncounted";

export function verdict(diff: number | null): VarianceVerdict {
  if (diff === null) return "uncounted";
  if (diff === 0) return "exact";
  return diff > 0 ? "over" : "short";
}

/**
 * Fark kasaya yazılırsa hangi yönde ve ne kadar.
 * Eksik para bir giderdir, fazla para bir gelirdir. Sıfır fark kayıt doğurmaz.
 */
export function varianceMovement(diff: number | null): { direction: "in" | "out"; amount: number } | null {
  if (diff === null || diff === 0) return null;
  return diff > 0 ? { direction: "in", amount: diff } : { direction: "out", amount: Math.abs(diff) };
}

/** Gün açılırken devredilecek tutar: dünkü sayım. Sayılmamışsa sıfırdan başlar. */
export function carryOver(previous: SessionRow | null | undefined): number {
  if (!previous) return 0;
  return Math.max(0, previous.counted_close ?? 0);
}

/** Oturum kapatılabilir mi? Kapanmış oturum yeniden kapatılmaz. */
export function canClose(status: string): boolean {
  return status === "open";
}

export type SessionSummaryRow = {
  business_date: string;
  status: string;
  opening_float: number;
  counted_close?: number | null;
  expected_close?: number | null;
};

export type VarianceReport = {
  days: number;
  counted: number;
  exact: number;
  over: number;
  short: number;
  /** Fark toplamı — eksi ise dönem boyunca kasadan para eksilmiş. */
  netVariance: number;
  /** Yönü ne olursa olsun toplam sapma; küçük farklar birbirini gizlemesin. */
  absVariance: number;
  worst: SessionSummaryRow | null;
};

/**
 * Dönem raporu. Kapanmış oturumların dondurulmuş değerleri okunur; rapor
 * geçmişe bakar ve geçmiş bir daha değişmez.
 */
export function summarizeSessions(rows: SessionSummaryRow[]): VarianceReport {
  let counted = 0, exact = 0, over = 0, short = 0, netVariance = 0, absVariance = 0;
  let worst: SessionSummaryRow | null = null;
  let worstSize = 0;

  for (const row of rows) {
    const diff = variance(row, []);
    if (diff === null) continue;
    counted += 1;
    netVariance += diff;
    absVariance += Math.abs(diff);
    if (diff === 0) exact += 1;
    else if (diff > 0) over += 1;
    else short += 1;

    if (Math.abs(diff) > worstSize) {
      worstSize = Math.abs(diff);
      worst = row;
    }
  }

  return {
    days: rows.length,
    counted,
    exact,
    over,
    short,
    netVariance: Math.round(netVariance * 100) / 100,
    absVariance: Math.round(absVariance * 100) / 100,
    worst,
  };
}
