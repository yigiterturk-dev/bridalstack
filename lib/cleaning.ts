// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Temizleme — SAF KOD (veritabanı erişimi yok)                            ║
// ║                                                                          ║
// ║  Tek değişmez: temizlemedeki elbise raftan DIŞARIDADIR ve rafa yalnızca  ║
// ║  bir kez, "returned" adımında girer. Nereden geldiğine göre raftan       ║
// ║  düşme anı değişir, ama toplam etki her yolda +0'dır.                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const CLEANING_SOURCES = [
  { id: "stock", label: "Off the rail" },
  { id: "return", label: "From a return" },
  { id: "rental", label: "Back from rental" },
] as const;

export const CLEANING_STATUSES = ["pending", "sent", "returned", "written_off"] as const;
export type CleaningStatus = (typeof CLEANING_STATUSES)[number];

export const CLEANING_STATUS_LABELS: Record<CleaningStatus, string> = {
  pending: "Waiting to go",
  sent: "At the cleaner",
  returned: "Back on the rail",
  written_off: "Written off",
};

export function sourceLabel(id: string): string {
  return CLEANING_SOURCES.find((s) => s.id === id)?.label ?? id;
}

/**
 * İş açılırken raftan kaç adet düşer.
 * Yalnız raftaki mal için düşülür. İadeden veya kiradan gelen elbise zaten
 * rafa girmemişti; ikinci kez düşersek stok eksiye kayar.
 */
export function intakeStockDelta(source: string, quantity: number): number {
  const units = Math.max(0, quantity);
  return source === "stock" ? -units : 0;
}

/**
 * İş kapanırken rafa kaç adet girer.
 * Yalnız "returned" adımında ve kaynağı ne olursa olsun bir kez.
 * Hurdaya ayrılan mal rafa dönmez.
 */
export function outcomeStockDelta(status: string, quantity: number): number {
  return status === "returned" ? Math.max(0, quantity) : 0;
}

export function allowedTransitions(status: string): CleaningStatus[] {
  switch (status) {
    case "pending":
      return ["sent", "written_off"];
    case "sent":
      return ["returned", "written_off"];
    default:
      return [];
  }
}

export function canTransition(from: string, to: string): boolean {
  return allowedTransitions(from).includes(to as CleaningStatus);
}

/** Temizleme gideri kasaya yalnız iş kapanınca ve tutar varsa yazılır. */
export function shouldPostCost(status: string, cost: number): boolean {
  return status === "returned" && cost > 0;
}

/** Beklenen dönüş günü geçti mi? */
export function isOverdue(job: { status: string; expected_on?: string | null }, today: string): boolean {
  if (job.status !== "sent" || !job.expected_on) return false;
  return job.expected_on < today;
}
