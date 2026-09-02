// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Kiralama — SAF KOD (veritabanı erişimi yok)                             ║
// ║  Tarih çakışması, gecikme ve stok etkisi. Sayfalar da sunucu eylemleri   ║
// ║  de aynı fonksiyonları çağırır.                                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const RENTAL_STATUSES = ["reserved", "out", "returned", "cancelled"] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  reserved: "Reserved",
  out: "Out with the bride",
  returned: "Back in",
  cancelled: "Cancelled",
};

/** Rafı meşgul eden durumlar. İptal ve dönmüş kiralama takvimi kapatmaz. */
export const BLOCKING_STATUSES: RentalStatus[] = ["reserved", "out"];

export type DateRange = { start_date: string; due_date: string };

/**
 * İki tarih aralığı çakışıyor mu? Sınırlar dahildir: aynı elbise 10-12'de
 * biriyle, 12-14'te bir başkasıyla olamaz — 12'sinde iki gelin de bekler.
 */
export function overlaps(a: DateRange, b: DateRange): boolean {
  return a.start_date <= b.due_date && b.start_date <= a.due_date;
}

export type RentalSlot = DateRange & {
  id?: string;
  product_id: string;
  status: string;
};

/**
 * Yeni/güncellenen kiralama mevcutlarla çakışıyor mu?
 * Kendi kaydı hariç tutulur, böylece bir kiralama kendini engellemez.
 */
export function findConflict(existing: RentalSlot[], candidate: RentalSlot): RentalSlot | null {
  for (const row of existing) {
    if (row.id && candidate.id && row.id === candidate.id) continue;
    if (row.product_id !== candidate.product_id) continue;
    if (!BLOCKING_STATUSES.includes(row.status as RentalStatus)) continue;
    if (overlaps(row, candidate)) return row;
  }
  return null;
}

/** Aralık geçerli mi? Dönüş günü çıkış gününden önce olamaz. */
export function isValidRange(range: DateRange): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.start_date)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.due_date)) return false;
  return range.start_date <= range.due_date;
}

/** Bir kiralama bu durumdan hangi durumlara geçebilir? */
export function allowedTransitions(status: string): RentalStatus[] {
  switch (status) {
    case "reserved":
      return ["out", "cancelled"];
    case "out":
      return ["returned"];
    default:
      return [];
  }
}

export function canTransition(from: string, to: string): boolean {
  return allowedTransitions(from).includes(to as RentalStatus);
}

/**
 * Durum değişiminin raftaki adede etkisi.
 * Elbise yalnızca gelinin eline geçtiğinde (out) raftan düşer; rezervasyon
 * tek başına stoğu azaltmaz — takvimi kapatır, malı değil.
 * Dönüşte artış BURADA verilmez: elbise ya doğrudan rafa, ya temizlemeye
 * gider; o kararı `returnRestockUnits` verir.
 */
export function stockDelta(from: string, to: string): number {
  if (from === "reserved" && to === "out") return -1;
  return 0;
}

/**
 * Kiralama dönüşünde rafa kaç adet girer.
 * Temizleme gerekiyorsa raf ARTMAZ: elbise temizleme işine geçer ve rafa
 * ancak temizlemeden döndüğünde girer. Böylece kirli elbise satışa çıkmaz.
 */
export function returnRestockUnits(needsCleaning: boolean): number {
  return needsCleaning ? 0 : 1;
}

/** Gün farkı (b − a), tam gün. Her iki taraf da "YYYY-MM-DD". */
export function daysBetween(a: string, b: string): number {
  const from = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const to = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((to - from) / 86_400_000);
}

export type LateInput = {
  status: string;
  due_date: string;
  returned_on?: string | null;
  late_fee_per_day?: number;
  late_fee_collected?: number;
};

/**
 * Kaç gün gecikildi. Söz verilen gün geç sayılmaz; ertesi gün 1'dir.
 * Dönmüş kiralamada fiili dönüş günü, dışarıdakinde bugün ölçülür.
 */
export function lateDays(rental: LateInput, today: string): number {
  if (rental.status === "cancelled") return 0;
  const measured =
    rental.status === "returned" ? rental.returned_on ?? rental.due_date : today;
  return Math.max(0, daysBetween(rental.due_date, measured));
}

/**
 * Gecikme bedeli. Otomatik tahsil EDİLMEZ — ekranda "tahsil et" olarak
 * gösterilir; kasaya elle girilir. Kimsenin haberi olmadan para yazmayız.
 */
export function lateFee(rental: LateInput, today: string): number {
  const rate = rental.late_fee_per_day ?? 0;
  if (rate <= 0) return 0;
  return Math.round(lateDays(rental, today) * rate * 100) / 100;
}

/**
 * Henüz tahsil edilmemiş gecikme bedeli.
 * Tahsil edilen düşülür; buton iki kez basılınca ikincisinde tahsil edilecek
 * bir şey kalmaz. Gecikme sürerse fark yeniden büyür ve yine tahsil edilebilir.
 */
export function outstandingLateFee(rental: LateInput, today: string): number {
  const collected = Math.max(0, rental.late_fee_collected ?? 0);
  return Math.max(0, Math.round((lateFee(rental, today) - collected) * 100) / 100);
}

/** Dışarıda ve süresi geçmiş mi? Liste sıralaması bunu başa alır. */
export function isOverdue(rental: LateInput, today: string): boolean {
  return rental.status === "out" && lateDays(rental, today) > 0;
}
