// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Tadilat — SAF KOD (veritabanı erişimi yok)                              ║
// ║  Tadilat ücreti yalnız teslimde, yalnız bir kez kasaya yazılır.          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const ALTERATION_KINDS = [
  { id: "hem", label: "Hem" },
  { id: "bust", label: "Bust" },
  { id: "waist", label: "Waist" },
  { id: "straps", label: "Straps" },
  { id: "bustle", label: "Bustle" },
  { id: "beading", label: "Beading & repair" },
  { id: "other", label: "Other" },
] as const;

export const ALTERATION_STATUSES = [
  "requested",
  "in_progress",
  "ready",
  "delivered",
  "cancelled",
] as const;
export type AlterationStatus = (typeof ALTERATION_STATUSES)[number];

export const ALTERATION_STATUS_LABELS: Record<AlterationStatus, string> = {
  requested: "Requested",
  in_progress: "On the table",
  ready: "Ready for pickup",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function kindLabel(id: string): string {
  return ALTERATION_KINDS.find((k) => k.id === id)?.label ?? id;
}

export function allowedTransitions(status: string): AlterationStatus[] {
  switch (status) {
    case "requested":
      return ["in_progress", "cancelled"];
    case "in_progress":
      return ["ready", "cancelled"];
    case "ready":
      return ["delivered"];
    default:
      return [];
  }
}

export function canTransition(from: string, to: string): boolean {
  return allowedTransitions(from).includes(to as AlterationStatus);
}

/**
 * Ücret kasaya girer mi? Yalnız teslimde ve yalnız tutar varsa.
 * İptal edilen iş para doğurmaz; hazır ama teslim edilmemiş iş de doğurmaz —
 * gelin gelmeden kasaya para yazmayız.
 */
export function shouldCharge(status: string, price: number): boolean {
  return status === "delivered" && price > 0;
}

export type DueInput = { status: string; promised_date?: string | null };

/** Açık iş mi? Teslim edilen ve iptal edilen işler listeyi meşgul etmez. */
export function isOpen(status: string): boolean {
  return status === "requested" || status === "in_progress" || status === "ready";
}

/** Söz verilen gün geçti ve iş hâlâ elimizde mi? */
export function isOverdue(job: DueInput, today: string): boolean {
  if (!isOpen(job.status) || !job.promised_date) return false;
  return job.promised_date < today;
}

/**
 * Sıralama anahtarı: geciken işler en başta, sonra söz verilen güne göre,
 * tarihsiz işler en sonda. Düğün tarihi kaçan gelin listenin dibinde kalmasın.
 */
export function urgencyKey(job: DueInput, today: string): string {
  if (!isOpen(job.status)) return "3";
  if (isOverdue(job, today)) return `0${job.promised_date}`;
  return job.promised_date ? `1${job.promised_date}` : "2";
}
