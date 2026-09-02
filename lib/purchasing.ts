// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Satın alma — SAF KOD (veritabanı erişimi yok)                           ║
// ║                                                                          ║
// ║  Tek değişmez: stok yalnız mal TESLİM ALINIRKEN ve yalnız aradaki fark   ║
// ║  kadar artar. Sipariş vermek rafı doldurmaz; iki kez "teslim aldım"      ║
// ║  demek de rafı ikinci kez doldurmaz.                                     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const PO_STATUSES = ["draft", "ordered", "partial", "received", "cancelled"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export const PO_STATUS_LABELS: Record<PoStatus, string> = {
  draft: "Draft",
  ordered: "Ordered",
  partial: "Part delivered",
  received: "Delivered",
  cancelled: "Cancelled",
};

/** Kalemleri hâlâ değiştirilebilen sipariş. Yola çıkmış sipariş dondurulur. */
export function isEditable(status: string): boolean {
  return status === "draft";
}

/** Mal kabul edilebilir mi? Taslak sipariş henüz tedarikçiye gitmemiştir. */
export function canReceive(status: string): boolean {
  return status === "ordered" || status === "partial";
}

export type PoLine = {
  ordered_qty: number;
  received_qty: number;
  unit_cost: number;
};

/**
 * Bir kalemin yeni teslim adedi ne olabilir.
 * Adet geriye alınamaz ve sipariş edilenden fazlası kabul edilemez: tedarikçi
 * 3 elbise sözü verdiyse 5 elbise rafı doldurmaz.
 */
export function clampReceived(line: PoLine, requested: number): number {
  if (!Number.isFinite(requested)) return line.received_qty;
  const floor = Math.max(0, line.received_qty);
  return Math.min(line.ordered_qty, Math.max(floor, Math.round(requested)));
}

/** Bu kalemde rafa kaç adet girecek — yalnız aradaki fark. */
export function receiveDelta(line: PoLine, requested: number): number {
  return clampReceived(line, requested) - line.received_qty;
}

export type PoSummary = {
  lines: number;
  orderedUnits: number;
  receivedUnits: number;
  outstandingUnits: number;
  /** Sipariş edilenin toplam maliyeti. */
  orderedCost: number;
  /** Fiilen teslim alınanın maliyeti — kasaya yazılan tutar budur. */
  receivedCost: number;
  /** Tek kalem bile eksikse false. */
  complete: boolean;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function summarize(lines: PoLine[]): PoSummary {
  let orderedUnits = 0, receivedUnits = 0, orderedCost = 0, receivedCost = 0;

  for (const line of lines) {
    orderedUnits += line.ordered_qty;
    receivedUnits += line.received_qty;
    orderedCost += line.ordered_qty * line.unit_cost;
    receivedCost += line.received_qty * line.unit_cost;
  }

  return {
    lines: lines.length,
    orderedUnits,
    receivedUnits,
    outstandingUnits: Math.max(0, orderedUnits - receivedUnits),
    orderedCost: round(orderedCost),
    receivedCost: round(receivedCost),
    complete: lines.length > 0 && receivedUnits >= orderedUnits,
  };
}

/**
 * Mal kabulünden sonra siparişin durumu ne olmalı.
 * Hepsi geldiyse kapanır; bir kısmı geldiyse "kısmi"de bekler. Durum elle
 * seçilmez, kalemlerden okunur — ekranla veri asla ayrışmaz.
 */
export function statusAfterReceipt(lines: PoLine[]): PoStatus {
  const s = summarize(lines);
  if (s.complete) return "received";
  return s.receivedUnits > 0 ? "partial" : "ordered";
}

/**
 * Sipariş iptal edilebilir mi?
 * Tek adet bile mal girdiyse iptal edilemez: raftaki elbisenin kaydı silinmez,
 * eksiğiyle kapatılır.
 */
export function canCancel(status: string, lines: PoLine[]): boolean {
  if (status !== "draft" && status !== "ordered" && status !== "partial") return false;
  return summarize(lines).receivedUnits === 0;
}

/** Eksik gelen sipariş elle kapatılabilir mi? */
export function canCloseShort(status: string, lines: PoLine[]): boolean {
  const s = summarize(lines);
  return status === "partial" && s.receivedUnits > 0 && !s.complete;
}

/**
 * Mal bedeli kasaya girer mi? Yalnız sipariş kapanınca ve fiilen teslim
 * alınan kadar. Sipariş vermek para harcamak değildir.
 */
export function shouldPostCost(status: string, lines: PoLine[]): boolean {
  return status === "received" && summarize(lines).receivedCost > 0;
}

/** Tedarikçinin teslim süresinden beklenen tarih. */
export function expectedFromLeadTime(today: string, leadTimeDays: number | null | undefined): string | null {
  if (!leadTimeDays || leadTimeDays <= 0) return null;
  const base = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  return new Date(base + leadTimeDays * 86_400_000).toISOString().slice(0, 10);
}

/** Beklenen gün geçti ve mal hâlâ eksik mi? */
export function isLate(
  po: { status: string; expected_on?: string | null },
  lines: PoLine[],
  today: string
): boolean {
  if (!canReceive(po.status) || !po.expected_on) return false;
  return po.expected_on < today && !summarize(lines).complete;
}
