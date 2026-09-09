// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Sipariş kalemleri — SAF KOD (veritabanı erişimi yok)                    ║
// ║                                                                          ║
// ║  Tek değişmez: sipariş toplamı ekrandan gelmez, KALEMLERDEN hesaplanır.  ║
// ║  Kalemi olmayan eski sipariş elle girilen toplamıyla aynen çalışır —     ║
// ║  hiçbir kayıt geriye dönük bozulmaz.                                     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const LINE_KINDS = [
  { id: "gown", label: "Gown" },
  { id: "veil", label: "Veil" },
  { id: "accessory", label: "Accessory" },
  { id: "alteration", label: "Alteration" },
  { id: "service", label: "Service" },
  { id: "other", label: "Other" },
] as const;

export type LineKind = (typeof LINE_KINDS)[number]["id"];

export function kindLabel(id: string): string {
  return LINE_KINDS.find((k) => k.id === id)?.label ?? id;
}

export type OrderLineInput = {
  quantity: number;
  unit_price: number;
  discount: number;
  kind?: string;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Kalemin indirim öncesi tutarı. */
export function lineGross(line: OrderLineInput): number {
  return round(Math.max(0, line.quantity) * Math.max(0, line.unit_price));
}

/**
 * Kalemin ödenecek tutarı.
 * İndirim kalemin kendisinden büyük olamaz: satır eksiye düşüp diğer
 * kalemlerin parasını yemez.
 */
export function lineNet(line: OrderLineInput): number {
  const gross = lineGross(line);
  return round(Math.max(0, gross - Math.max(0, line.discount)));
}

/** Kaleme fiilen uygulanan indirim — girilen değil, tavana çekilmiş hâli. */
export function lineDiscount(line: OrderLineInput): number {
  return round(lineGross(line) - lineNet(line));
}

export type OrderTotals = {
  /** İndirim öncesi liste toplamı. */
  list: number;
  /** Ödenecek toplam — sipariş kaydındaki `discounted_total` budur. */
  net: number;
  discount: number;
  units: number;
  lines: number;
};

export function totals(lines: OrderLineInput[]): OrderTotals {
  let list = 0, net = 0, units = 0;

  for (const line of lines) {
    list += lineGross(line);
    net += lineNet(line);
    units += Math.max(0, line.quantity);
  }

  return {
    list: round(list),
    net: round(net),
    discount: round(list - net),
    units,
    lines: lines.length,
  };
}

/** Tür bazında kırılım — prim kuralları ve raporlar bunu okuyacak. */
export function totalsByKind(lines: OrderLineInput[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of lines) {
    const kind = line.kind ?? "other";
    out[kind] = round((out[kind] ?? 0) + lineNet(line));
  }
  return out;
}

/**
 * Siparişin toplamları kalemlerden mi okunacak?
 * Tek kalem bile varsa evet. Kalemsiz sipariş elle girilen toplamını korur —
 * kalem özelliği açıldı diye eski siparişlerin tutarı sıfırlanmaz.
 */
export function derivesFromLines(lineCount: number): boolean {
  return lineCount > 0;
}

/**
 * Kalem değişince siparişe yazılacak toplamlar.
 * Kalem yoksa `null` döner: çağıran hiçbir şey yazmaz, mevcut tutar durur.
 */
export function derivedOrderTotals(
  lines: OrderLineInput[]
): { list_total: number; discounted_total: number } | null {
  if (!derivesFromLines(lines.length)) return null;
  const t = totals(lines);
  return { list_total: t.list, discounted_total: t.net };
}

/**
 * Kalan bakiye. Kapora ve ödenmiş taksitler düşülür, eksiye inmez.
 * `syncOrderBalance` ile aynı kural — burada saf hâliyle test edilebilsin diye.
 */
export function remainingBalance(discountedTotal: number, collected: number): number {
  return round(Math.max(0, discountedTotal - collected));
}

// ── Sipariş kurulurken girilen taslak kalemler ────────────────────────────────
//
// Form kalemleri paralel diziler hâlinde gönderir ve her zaman en az bir boş
// satır taşır. Ayrıştırma burada saf tutulur ki sunucu eylemi test edilebilir
// bir kuralı çağırsın, kendi içinde ayrıştırma yapmasın.

export type DraftLineRow = {
  kind?: string;
  description?: string;
  quantity?: string;
  unit_price?: string;
  discount?: string;
  product_id?: string;
  note?: string;
};

export type DraftLine = OrderLineInput & {
  kind: string;
  description: string;
  product_id: string | null;
  note: string | null;
};

function positiveNumber(raw: string | undefined): number {
  const n = parseFloat(String(raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? round(n) : 0;
}

/**
 * Doldurulmuş satırları kaleme çevirir.
 *
 * Boş satır sessizce atılır — kullanıcı üç satır açıp birini doldurduğunda
 * sipariş iki hayalet kalemle kurulmasın. Adı boş ama ürünü seçili satır
 * KALIR: adı sunucu ürün kaydından doldurur, `addOrderLine` ile aynı kural.
 */
export function parseDraftLines(rows: DraftLineRow[]): DraftLine[] {
  const out: DraftLine[] = [];

  for (const raw of rows) {
    const description = String(raw.description ?? "").trim();
    const product_id = String(raw.product_id ?? "").trim() || null;
    const unit_price = positiveNumber(raw.unit_price);

    // Ne adı ne ürünü ne de fiyatı olan satır hiç girilmemiş sayılır.
    if (!description && !product_id && unit_price === 0) continue;

    const kind = String(raw.kind ?? "").trim();
    const quantity = Math.max(1, Math.floor(Number(raw.quantity) || 0) || 1);

    out.push({
      kind: (LINE_KINDS as readonly { id: string }[]).some((k) => k.id === kind) ? kind : "gown",
      description,
      product_id,
      quantity,
      unit_price,
      discount: positiveNumber(raw.discount),
      note: String(raw.note ?? "").trim() || null,
    });
  }

  return out;
}
