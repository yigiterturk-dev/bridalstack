// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Alacaklar — SAF KOD (veritabanı erişimi yok)                            ║
// ║  Siparişleri ve taksitleri "kim ne kadar borçlu" tablosuna çevirir.      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type OrderInput = {
  id: string;
  ref_no: string;
  customer_id: string;
  status: string;
  discounted_total: number;
  deposit_amount: number;
  order_date: string | null;
  created_at: Date;
};

export type InstallmentInput = {
  order_id: string | null;
  amount: number;
  due_date: string; // YYYY-MM-DD
  paid_at: Date | null;
  status: string;
};

/** Vade yaşlandırma kovaları — tahsilat önceliğini belirler. */
export type AgingBucket = "current" | "d1_30" | "d31_60" | "d61_plus";

export const AGING_LABELS: Record<AgingBucket, string> = {
  current: "Not yet due",
  d1_30: "1–30 days",
  d31_60: "31–60 days",
  d61_plus: "60+ days",
};

export type Receivable = {
  orderId: string;
  ref_no: string;
  customer_id: string;
  total: number;
  collected: number;
  outstanding: number;
  /** Ödenmemiş en yakın taksitin vadesi; plan yoksa null. */
  nextDueDate: string | null;
  /** En eski ödenmemiş taksitin kaç gün geciktiği; gecikme yoksa 0. */
  daysOverdue: number;
  bucket: AgingBucket;
  installmentCount: number;
  paidCount: number;
};

const DAY = 86_400_000;

function dayUTC(value: Date | string): number {
  const d = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY);
}

function bucketFor(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "d1_30";
  if (daysOverdue <= 60) return "d31_60";
  return "d61_plus";
}

/**
 * Her sipariş için tahsil edilen ve kalan tutarı hesaplar.
 *
 * Tahsil edilen = kapora + ödenmiş taksitler. Taksit planı yoksa sipariş
 * kapora dışında ödenmemiş sayılır; bu, siparişin kendi remaining_balance
 * alanına güvenmekten daha doğrudur çünkü o alan elle bozulabilir.
 *
 * İptal edilmiş siparişler hiç listelenmez, borç değildirler.
 */
export function buildReceivables(
  orders: OrderInput[],
  installments: InstallmentInput[],
  now: Date = new Date()
): Receivable[] {
  const byOrder = new Map<string, InstallmentInput[]>();
  for (const i of installments) {
    if (!i.order_id || i.status === "cancelled") continue;
    const list = byOrder.get(i.order_id) ?? [];
    list.push(i);
    byOrder.set(i.order_id, list);
  }

  const today = dayUTC(now);
  const result: Receivable[] = [];

  for (const o of orders) {
    if (o.status === "cancelled") continue;

    const plan = byOrder.get(o.id) ?? [];
    const paidRows = plan.filter((i) => i.status === "paid" || i.paid_at);
    const unpaid = plan.filter((i) => !(i.status === "paid" || i.paid_at));

    const paidAmount = paidRows.reduce((s, i) => s + i.amount, 0);
    const collected = o.deposit_amount + paidAmount;
    const outstanding = Math.max(0, Number((o.discounted_total - collected).toFixed(2)));

    if (outstanding <= 0) continue;

    const dueDays = unpaid.map((i) => dayUTC(i.due_date)).sort((a, b) => a - b);
    const nextDue = dueDays.length ? unpaid.slice().sort((a, b) => dayUTC(a.due_date) - dayUTC(b.due_date))[0].due_date : null;
    const oldestOverdue = dueDays.length ? today - dueDays[0] : 0;
    const daysOverdue = Math.max(0, oldestOverdue);

    result.push({
      orderId: o.id,
      ref_no: o.ref_no,
      customer_id: o.customer_id,
      total: o.discounted_total,
      collected,
      outstanding,
      nextDueDate: nextDue,
      daysOverdue,
      bucket: bucketFor(daysOverdue),
      installmentCount: plan.length,
      paidCount: paidRows.length,
    });
  }

  // En çok geciken önce; eşitlikte en büyük borç önce.
  return result.sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstanding - a.outstanding);
}

export type AgingSummary = Record<AgingBucket, { count: number; amount: number }>;

export function summarizeAging(receivables: Receivable[]): AgingSummary {
  const empty: AgingSummary = {
    current: { count: 0, amount: 0 },
    d1_30: { count: 0, amount: 0 },
    d31_60: { count: 0, amount: 0 },
    d61_plus: { count: 0, amount: 0 },
  };
  for (const r of receivables) {
    empty[r.bucket].count += 1;
    empty[r.bucket].amount += r.outstanding;
  }
  return empty;
}

export function totalOutstanding(receivables: Receivable[]): number {
  return Number(receivables.reduce((s, r) => s + r.outstanding, 0).toFixed(2));
}
