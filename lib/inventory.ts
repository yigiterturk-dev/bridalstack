// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Envanter — SAF KOD (veritabanı erişimi yok)                             ║
// ║  Stok sayımı farkları ve iade kuralları. Tek doğruluk kaynağı burasıdır; ║
// ║  sayfalar da sunucu eylemleri de aynı fonksiyonları çağırır.             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const RETURN_REASONS = [
  { id: "sizing", label: "Sizing" },
  { id: "damaged", label: "Arrived damaged" },
  { id: "changed_mind", label: "Changed her mind" },
  { id: "wrong_item", label: "Wrong item" },
  { id: "other", label: "Other" },
] as const;

export const RETURN_CONDITIONS = [
  { id: "resellable", label: "Resellable" },
  { id: "needs_cleaning", label: "Needs cleaning" },
  { id: "damaged", label: "Damaged" },
] as const;

export const RETURN_STATUSES = ["pending", "approved", "rejected", "completed"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export type CountItem = {
  expected_qty: number;
  counted_qty: number | null;
};

/** Sayılan ile beklenen arasındaki fark. Henüz sayılmadıysa null. */
export function variance(item: CountItem): number | null {
  if (item.counted_qty === null || item.counted_qty === undefined) return null;
  return item.counted_qty - item.expected_qty;
}

export type CountSummary = {
  total: number;
  counted: number;
  pending: number;
  /** Kayıttan fazla çıkan kalem sayısı. */
  over: number;
  /** Kayıttan eksik çıkan kalem sayısı. */
  short: number;
  /** Tam tutan kalem sayısı. */
  exact: number;
  /** Fark toplamı (adet). Eksi ise raftan kayıp var demektir. */
  netUnits: number;
  /** Sayılan kalemlerin yüzde kaçı tam tuttu; hiç sayılmadıysa null. */
  accuracy: number | null;
};

export function summarizeCount(items: CountItem[]): CountSummary {
  let counted = 0, over = 0, short = 0, exact = 0, netUnits = 0;

  for (const item of items) {
    const diff = variance(item);
    if (diff === null) continue;
    counted += 1;
    netUnits += diff;
    if (diff > 0) over += 1;
    else if (diff < 0) short += 1;
    else exact += 1;
  }

  return {
    total: items.length,
    counted,
    pending: items.length - counted,
    over,
    short,
    exact,
    netUnits,
    accuracy: counted > 0 ? Math.round((exact / counted) * 100) : null,
  };
}

/**
 * Sayım kapatılırken ürünün yeni stok adedi.
 * Sayılmamış kalem ellenmez: "girilmedi" ile "sıfır sayıldı" aynı şey değildir.
 */
export function closingQuantity(item: CountItem): number | null {
  if (item.counted_qty === null || item.counted_qty === undefined) return null;
  return Math.max(0, item.counted_qty);
}

export type ReturnLine = {
  quantity: number;
  condition: string;
  restock: boolean;
};

/**
 * İade tamamlanınca stoğa kaç adet geri döner.
 * Hasarlı mal rafa geri konmaz — kutu işaretli olsa bile.
 * Temizlik isteyen mal da DOĞRUDAN dönmez: temizleme işine geçer ve rafa
 * ancak temizlemeden döndüğünde girer (bkz. `needsCleaningJob`). Kirli
 * elbiseyi rafa koyarsak bir sonraki geline kirli elbise gösteririz.
 */
export function restockUnits(line: ReturnLine): number {
  if (!line.restock) return 0;
  if (line.condition === "damaged") return 0;
  if (line.condition === "needs_cleaning") return 0;
  return Math.max(0, line.quantity);
}

/**
 * İade kapanırken temizleme işi açılmalı mı?
 * Mal rafa dönecekse ve kirliyse evet — böylece elbise iki kayıt arasında
 * kaybolmaz; hep bir yerde görünür.
 */
export function needsCleaningJob(line: ReturnLine): boolean {
  return line.restock && line.condition === "needs_cleaning";
}

/** Bir iade bu durumdan hangi durumlara geçebilir? Bitmiş iade geri alınmaz. */
export function allowedTransitions(status: string): ReturnStatus[] {
  switch (status) {
    case "pending":
      return ["approved", "rejected"];
    case "approved":
      return ["completed", "rejected"];
    default:
      return [];
  }
}

export function canTransition(from: string, to: string): boolean {
  return allowedTransitions(from).includes(to as ReturnStatus);
}
