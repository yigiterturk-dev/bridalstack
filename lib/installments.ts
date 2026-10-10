// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Taksit (installment) planı + hatırlatma mantığı — SAF KOD (DB yazımı yok) ║
// ║  Stripe ile gerçek tahsilat env'e bağlı; burada yalnızca plan + durum +    ║
// ║  hatırlatma kararı hesaplanır.                                             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type InstallmentStatus = "pending" | "due" | "overdue" | "paid" | "cancelled";
export type ReminderKind = "upcoming" | "due_today" | "overdue";

export type InstallmentRow = {
  id: string;
  tenant_id: string;
  amount: number;
  due_date: string; // YYYY-MM-DD
  paid_at: string | null;
  status: InstallmentStatus;
};

// Vade öncesi kaç gün önceden hatırlatma yapılacağı.
export const UPCOMING_REMINDER_DAYS = 3;

// Tarihi gün hassasiyetinde (UTC) normalize eder.
function dayUTC(d: Date | string): number {
  const dt = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00Z" : "")) : d;
  return Math.floor(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()) / 86400000);
}

// İki tarih arasındaki tam gün farkı (due - today). Pozitif = gelecekte.
export function daysUntilDue(dueDate: string, now: Date = new Date(), todayOverride?: string): number {
  return dayUTC(dueDate) - (todayOverride ? dayUTC(todayOverride) : dayUTC(now));
}

// ───────────────────────────────────────────────────────────────────────────
// Taksit planı oluşturma: toplam tutarı n eşit (son taksitte yuvarlama farkı)
// parçaya böler ve aylık vadeler atar.
// ───────────────────────────────────────────────────────────────────────────
export type PlannedInstallment = {
  installment_no: number;
  total_count: number;
  amount: number;
  due_date: string; // YYYY-MM-DD
};

function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function buildInstallmentPlan(
  totalAmount: number,
  count: number,
  firstDueDate: string,
  intervalMonths = 1
): PlannedInstallment[] {
  const n = Math.max(1, Math.floor(count));
  const total = Math.round(Number(totalAmount) * 100); // kuruş
  const base = Math.floor(total / n);
  const remainder = total - base * n;

  const start = new Date(firstDueDate + "T00:00:00Z");
  const plan: PlannedInstallment[] = [];

  for (let i = 0; i < n; i++) {
    // Yuvarlama farkını ilk taksite ekle (toplam korunur).
    const cents = base + (i === 0 ? remainder : 0);
    const due = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i * intervalMonths, start.getUTCDate()));
    plan.push({
      installment_no: i + 1,
      total_count: n,
      amount: cents / 100,
      due_date: fmtDate(due),
    });
  }
  return plan;
}

// ───────────────────────────────────────────────────────────────────────────
// Durum geçişi: ödenmemiş bir taksitin bugünkü tarihe göre statüsünü türetir.
// pending → due (vade penceresinde) → overdue (vade geçti). paid/cancelled sabit.
// ───────────────────────────────────────────────────────────────────────────
export function deriveStatus(inst: Pick<InstallmentRow, "due_date" | "paid_at" | "status">, now: Date = new Date(), todayOverride?: string): InstallmentStatus {
  if (inst.status === "paid" || inst.paid_at) return "paid";
  if (inst.status === "cancelled") return "cancelled";
  const diff = daysUntilDue(inst.due_date, now, todayOverride);
  if (diff < 0) return "overdue";
  if (diff <= UPCOMING_REMINDER_DAYS) return "due";
  return "pending";
}

// ───────────────────────────────────────────────────────────────────────────
// Hatırlatma kararı: bu taksit için hangi (varsa) hatırlatma türü gönderilmeli?
// Cron, sonucu installment_reminders tablosuyla deduplike eder (UNIQUE kind).
// ───────────────────────────────────────────────────────────────────────────
export function reminderFor(
  inst: Pick<InstallmentRow, "due_date" | "paid_at" | "status">,
  now: Date = new Date(),
  todayOverride?: string
): ReminderKind | null {
  if (inst.status === "paid" || inst.paid_at || inst.status === "cancelled") return null;
  const diff = daysUntilDue(inst.due_date, now, todayOverride);
  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  if (diff <= UPCOMING_REMINDER_DAYS) return "upcoming";
  return null;
}
