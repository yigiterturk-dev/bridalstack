// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Prim — SAF KOD (veritabanı erişimi yok)                                  ║
// ║  Hangi kural hangi siparişe uyar, ne kadar prim doğar, kim ne hak etti.   ║
// ║  Para hesabı tek yerde durur: sayfa da, ödeme kaydı da burayı çağırır.    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type CommissionRule = {
  id: string;
  name: string;
  scope: string; // all | staff
  staff_name: string | null;
  rate_percent: number;
  flat_amount: number;
  min_order_total: number;
  priority: number;
  is_active: boolean;
};

export type CommissionOrder = {
  id: string;
  ref_no: string;
  sales_person: string | null;
  status: string;
  discounted_total: number;
  order_date: string | null; // "2026-09-02"
  created_at: Date;
};

/** Primi hak edilmiş sayılmayan sipariş durumları. */
export const NON_EARNING_STATUSES = ["cancelled", "draft", "refunded"] as const;

export const UNASSIGNED = "Unassigned";

/** İsim eşleşmesi büyük/küçük harf ve baştaki-sondaki boşluğa takılmaz. */
function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

export function salesPersonOf(order: CommissionOrder): string {
  const name = (order.sales_person ?? "").trim();
  return name.length > 0 ? name : UNASSIGNED;
}

/** Sipariş prim doğurur mu? İptal/taslak sipariş için prim yazılmaz. */
export function isEarning(order: CommissionOrder): boolean {
  return !(NON_EARNING_STATUSES as readonly string[]).includes(order.status);
}

/**
 * Siparişe uyan kurallardan uygulanacak olanı seçer.
 * Önce öncelik, eşitlikte satışçıya özel kural genel kuralı yener —
 * "herkese %5, Ayşe'ye %8" yazan bir kullanıcı Ayşe'ye 8 bekler.
 */
export function matchRule(order: CommissionOrder, rules: CommissionRule[]): CommissionRule | null {
  const candidates = rules.filter((r) => {
    if (!r.is_active) return false;
    if (order.discounted_total < r.min_order_total) return false;
    if (r.scope === "staff") return sameName(r.staff_name, salesPersonOf(order));
    return true;
  });

  if (candidates.length === 0) return null;

  return candidates.reduce((best, r) => {
    if (r.priority !== best.priority) return r.priority > best.priority ? r : best;
    const rSpecific = r.scope === "staff" ? 1 : 0;
    const bSpecific = best.scope === "staff" ? 1 : 0;
    if (rSpecific !== bSpecific) return rSpecific > bSpecific ? r : best;
    return best;
  });
}

/** Bir siparişin primi. Kural yoksa ya da sipariş hak etmiyorsa sıfır. */
export function commissionFor(order: CommissionOrder, rules: CommissionRule[]): number {
  if (!isEarning(order)) return 0;
  const rule = matchRule(order, rules);
  if (!rule) return 0;
  const amount = (order.discounted_total * rule.rate_percent) / 100 + rule.flat_amount;
  return Math.max(0, Math.round(amount * 100) / 100);
}

/** Siparişin ait olduğu ay — "2026-09". Tarih girilmemişse kayıt anına düşer. */
export function periodOf(order: CommissionOrder): string {
  if (order.order_date && /^\d{4}-\d{2}/.test(order.order_date)) return order.order_date.slice(0, 7);
  return order.created_at.toISOString().slice(0, 7);
}

export type StaffCommission = {
  staff: string;
  orderCount: number;
  revenue: number;
  commission: number;
};

/** Bir dönemdeki siparişleri satışçıya göre toplar; primi en yüksek olan başta. */
export function summarizeByStaff(
  orders: CommissionOrder[],
  rules: CommissionRule[]
): StaffCommission[] {
  const byStaff = new Map<string, StaffCommission>();

  for (const order of orders) {
    if (!isEarning(order)) continue;
    const staff = salesPersonOf(order);
    const row = byStaff.get(staff) ?? { staff, orderCount: 0, revenue: 0, commission: 0 };
    row.orderCount += 1;
    row.revenue += order.discounted_total;
    row.commission += commissionFor(order, rules);
    byStaff.set(staff, row);
  }

  return [...byStaff.values()]
    .map((r) => ({ ...r, commission: Math.round(r.commission * 100) / 100 }))
    .sort((a, b) => b.commission - a.commission || b.revenue - a.revenue);
}

/** Seçim kutusu için, verideki en yeni aydan geriye doğru dönem listesi. */
export function periodOptions(orders: CommissionOrder[], now: Date = new Date()): string[] {
  const set = new Set<string>(orders.map(periodOf));
  set.add(now.toISOString().slice(0, 7));
  return [...set].sort().reverse();
}

export function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
