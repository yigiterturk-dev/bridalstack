// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Finans — SAF KOD (veritabanı erişimi yok)                                ║
// ║  Kasa hareketlerinin toplanması ve çek durum kuralları.                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const CASH_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "transfer", label: "Bank transfer" },
  { id: "check", label: "Check" },
  { id: "other", label: "Other" },
] as const;

export const INCOME_CATEGORIES = [
  { id: "deposit", label: "Deposit" },
  { id: "installment", label: "Installment" },
  { id: "balance", label: "Final balance" },
  { id: "alteration", label: "Alterations" },
  { id: "rental", label: "Rental" },
  { id: "other", label: "Other income" },
] as const;

export const EXPENSE_CATEGORIES = [
  { id: "stock", label: "Stock purchase" },
  { id: "rent", label: "Rent" },
  { id: "payroll", label: "Payroll" },
  { id: "commission", label: "Commission" },
  { id: "marketing", label: "Marketing" },
  { id: "refund", label: "Refund" },
  { id: "cleaning", label: "Cleaning & repairs" },
  { id: "utilities", label: "Utilities" },
  { id: "other", label: "Other expense" },
] as const;

export function categoryLabel(direction: string, id: string): string {
  const list = direction === "out" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  return list.find((c) => c.id === id)?.label ?? id;
}

export type Movement = {
  direction: string; // in | out
  amount: number;
  method: string;
  category: string;
  occurred_on: string; // "2026-09-02"
};

/** Hareketin kasaya etkisi: giriş artı, çıkış eksi. */
export function signedAmount(m: Pick<Movement, "direction" | "amount">): number {
  const value = Math.abs(m.amount);
  return m.direction === "out" ? -value : value;
}

export type MoneySummary = {
  inflow: number;
  outflow: number;
  net: number;
  count: number;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function summarize(movements: Movement[]): MoneySummary {
  let inflow = 0;
  let outflow = 0;

  for (const m of movements) {
    const value = Math.abs(m.amount);
    if (m.direction === "out") outflow += value;
    else inflow += value;
  }

  return { inflow: round(inflow), outflow: round(outflow), net: round(inflow - outflow), count: movements.length };
}

/** Kategori kırılımı — en çok para hareketi olan başta. */
export function groupByCategory(
  movements: Movement[],
  direction: "in" | "out"
): { category: string; label: string; total: number; count: number }[] {
  const byCategory = new Map<string, { total: number; count: number }>();

  for (const m of movements) {
    if (m.direction !== direction) continue;
    const row = byCategory.get(m.category) ?? { total: 0, count: 0 };
    row.total += Math.abs(m.amount);
    row.count += 1;
    byCategory.set(m.category, row);
  }

  return [...byCategory.entries()]
    .map(([category, r]) => ({
      category,
      label: categoryLabel(direction, category),
      total: round(r.total),
      count: r.count,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Ödeme yöntemi kırılımı — gün sonu kasa sayarken nakit ile kartı ayırır. */
export function groupByMethod(movements: Movement[]): { method: string; label: string; net: number }[] {
  const byMethod = new Map<string, number>();

  for (const m of movements) {
    byMethod.set(m.method, (byMethod.get(m.method) ?? 0) + signedAmount(m));
  }

  return [...byMethod.entries()]
    .map(([method, net]) => ({
      method,
      label: CASH_METHODS.find((x) => x.id === method)?.label ?? method,
      net: round(net),
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

/** Günlere göre net akış — defterdeki günlük satırlar için. */
export function dailyTotals(movements: Movement[]): { day: string; inflow: number; outflow: number; net: number }[] {
  const byDay = new Map<string, { inflow: number; outflow: number }>();

  for (const m of movements) {
    const row = byDay.get(m.occurred_on) ?? { inflow: 0, outflow: 0 };
    if (m.direction === "out") row.outflow += Math.abs(m.amount);
    else row.inflow += Math.abs(m.amount);
    byDay.set(m.occurred_on, row);
  }

  return [...byDay.entries()]
    .map(([day, r]) => ({ day, inflow: round(r.inflow), outflow: round(r.outflow), net: round(r.inflow - r.outflow) }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}

// ─── Çekler ────────────────────────────────────────────────────────────────

export const CHECK_STATUSES = ["portfolio", "deposited", "cleared", "bounced", "cancelled"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export const CHECK_STATUS_LABELS: Record<string, string> = {
  portfolio: "In portfolio",
  deposited: "Deposited",
  cleared: "Cleared",
  bounced: "Bounced",
  cancelled: "Cancelled",
};

/**
 * Çekin gidebileceği durumlar.
 * Karşılıksız çıkan çek tekrar bankaya verilebilir; tahsil edilmiş çek kapanır.
 */
export function checkTransitions(status: string): CheckStatus[] {
  switch (status) {
    case "portfolio":
      return ["deposited", "cleared", "cancelled"];
    case "deposited":
      return ["cleared", "bounced"];
    case "bounced":
      return ["deposited", "cancelled"];
    default:
      return [];
  }
}

export function canMoveCheck(from: string, to: string): boolean {
  return checkTransitions(from).includes(to as CheckStatus);
}

/** Hâlâ para bekleyen çekler: tahsil edilmemiş ve iptal edilmemiş olanlar. */
export function isOutstandingCheck(status: string): boolean {
  return status === "portfolio" || status === "deposited" || status === "bounced";
}

export type CheckRow = { direction: string; amount: number; due_date: string; status: string };

export type CheckSummary = {
  incoming: number;
  outgoing: number;
  overdue: number;
  dueThisWeek: number;
};

function dayNumber(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000);
}

export function summarizeChecks(checks: CheckRow[], now: Date = new Date()): CheckSummary {
  const today = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000
  );

  let incoming = 0, outgoing = 0, overdue = 0, dueThisWeek = 0;

  for (const c of checks) {
    if (!isOutstandingCheck(c.status)) continue;
    const value = Math.abs(c.amount);
    if (c.direction === "issued") outgoing += value;
    else incoming += value;

    const diff = dayNumber(c.due_date) - today;
    if (diff < 0) overdue += value;
    else if (diff <= 7) dueThisWeek += value;
  }

  return { incoming: round(incoming), outgoing: round(outgoing), overdue: round(overdue), dueThisWeek: round(dueThisWeek) };
}

/** "2026-09" dönemi için ay başı ve ay sonu tarihleri (dahil). */
export function monthRange(period: string): { from: string; to: string } {
  const [year, month] = period.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
