// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Prim — SAF KOD (veritabanı erişimi yok)                                  ║
// ║  Hangi kural hangi siparişe uyar, ne kadar prim doğar, kim ne hak etti.   ║
// ║  Para hesabı tek yerde durur: sayfa da, ödeme kaydı da burayı çağırır.    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { lineNet, totalsByKind } from "./order-lines.ts";

export type CommissionRule = {
  id: string;
  name: string;
  scope: string; // all | staff
  staff_name: string | null;
  /** order = siparişin tamamına · kind = yalnız belirli türdeki kalemlere */
  applies_to?: string;
  /** applies_to === "kind" ise hangi kalem türü */
  line_kind?: string | null;
  rate_percent: number;
  flat_amount: number;
  min_order_total: number;
  priority: number;
  is_active: boolean;
};

/** Prim hesabına giren kalem — `OrderLine`'ın yalnız gereken alanları. */
export type CommissionLine = {
  kind: string;
  quantity: number;
  unit_price: number;
  discount: number;
};

export function isKindRule(rule: CommissionRule): boolean {
  return rule.applies_to === "kind" && !!rule.line_kind;
}

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
 * Kural bu siparişe hiç bakabilir mi?
 * Alt sınır her zaman SİPARİŞ toplamına bakar, kalem toplamına değil:
 * "2000 altındaki siparişe prim yok" yazan kullanıcı siparişi kasteder.
 */
function isCandidate(rule: CommissionRule, order: CommissionOrder): boolean {
  if (!rule.is_active) return false;
  if (order.discounted_total < rule.min_order_total) return false;
  if (rule.scope === "staff") return sameName(rule.staff_name, salesPersonOf(order));
  return true;
}

/**
 * Özgüllük merdiveni — büyük olan kazanır.
 * Tür + satışçı  > tür  > satışçı  > herkes.
 * "Herkese %5, elbisede %8, Ayşe'nin elbisesinde %10" yazan kullanıcı
 * Ayşe'nin elbisesine 10 bekler.
 */
function specificity(rule: CommissionRule): number {
  return (isKindRule(rule) ? 2 : 0) + (rule.scope === "staff" ? 1 : 0);
}

/** İki adaydan hangisi uygulanır: önce öncelik, sonra özgüllük. */
function better(a: CommissionRule, b: CommissionRule): CommissionRule {
  if (a.priority !== b.priority) return a.priority > b.priority ? a : b;
  const sa = specificity(a);
  const sb = specificity(b);
  if (sa !== sb) return sa > sb ? a : b;
  return b;
}

/**
 * Siparişin tamamına uygulanacak kuralı seçer.
 * Tür kuralları buraya karışmaz — onlar kalem bazında çözülür.
 */
export function matchRule(order: CommissionOrder, rules: CommissionRule[]): CommissionRule | null {
  const candidates = rules.filter((r) => !isKindRule(r) && isCandidate(r, order));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, r) => better(r, best));
}

/**
 * Belirli bir kalem türüne uygulanacak kuralı seçer.
 * Aday havuzu: o türün kuralları + siparişin tamamına yazılmış kurallar.
 * Yani "herkese %5" yazıp "elbisede %8" eklersen elbise 8, gerisi 5 alır —
 * ikisi TOPLANMAZ. En özel kural o kalemi tek başına belirler.
 */
export function matchRuleForKind(
  order: CommissionOrder,
  rules: CommissionRule[],
  kind: string
): CommissionRule | null {
  const candidates = rules.filter((r) => {
    if (!isCandidate(r, order)) return false;
    return isKindRule(r) ? r.line_kind === kind : true;
  });
  if (candidates.length === 0) return null;
  return candidates.reduce((best, r) => better(r, best));
}

/** Kurallar arasında hiç tür kuralı var mı? Yoksa eski yol aynen işler. */
function hasKindRule(rules: CommissionRule[]): boolean {
  return rules.some(isKindRule);
}

export type CommissionBreakdownRow = {
  kind: string;
  base: number;
  rule: CommissionRule | null;
  amount: number;
};

/**
 * Primin tür tür dökümü. Ekran "hangi kalem hangi kuraldan ne kazandırdı"yı
 * bundan okur; toplam da buradan çıkar, ikinci bir hesap yoktur.
 */
export function commissionBreakdown(
  order: CommissionOrder,
  rules: CommissionRule[],
  lines: CommissionLine[]
): CommissionBreakdownRow[] {
  if (!isEarning(order)) return [];

  const byKind = totalsByKind(lines);
  return Object.entries(byKind).map(([kind, base]) => {
    const rule = matchRuleForKind(order, rules, kind);
    const amount = rule ? Math.max(0, Math.round(((base * rule.rate_percent) / 100) * 100) / 100) : 0;
    return { kind, base, rule, amount };
  });
}

/**
 * Bir siparişin primi. Kural yoksa ya da sipariş hak etmiyorsa sıfır.
 *
 * İki yol var ve hangisinin işlediği verinin kendisinden belli olur:
 *
 *  • Tür kuralı yoksa VEYA siparişin kalemi yoksa → eski yol: tek kural,
 *    siparişin tamamı, yüzde + sabit. Mevcut kurallar bu yüzden hiç etkilenmez.
 *
 *  • Tür kuralı varsa ve siparişin kalemi varsa → her tür kendi kuralını bulur,
 *    yüzdeler kalem toplamlarına uygulanır ve TOPLANIR. Sabit bonus yalnız
 *    siparişin tamamına yazılmış kuraldan, bir kez eklenir: sabit bonus sipariş
 *    başınadır, kalem türü başına değil.
 */
export function commissionFor(
  order: CommissionOrder,
  rules: CommissionRule[],
  lines: CommissionLine[] = []
): number {
  if (!isEarning(order)) return 0;

  const orderRule = matchRule(order, rules);

  if (lines.length === 0 || !hasKindRule(rules)) {
    if (!orderRule) return 0;
    const amount = (order.discounted_total * orderRule.rate_percent) / 100 + orderRule.flat_amount;
    return Math.max(0, Math.round(amount * 100) / 100);
  }

  const fromLines = commissionBreakdown(order, rules, lines).reduce((sum, row) => sum + row.amount, 0);
  const flat = orderRule?.flat_amount ?? 0;
  return Math.max(0, Math.round((fromLines + flat) * 100) / 100);
}

/** Kalemlerin toplam net tutarı — kalem tabanlı primin dayandığı ciro. */
export function lineRevenue(lines: CommissionLine[]): number {
  return Math.round(lines.reduce((sum, l) => sum + lineNet(l), 0) * 100) / 100;
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

/**
 * Bir dönemdeki siparişleri satışçıya göre toplar; primi en yüksek olan başta.
 * `linesByOrder` verilirse tür kuralları da işler; verilmezse eski yol.
 */
export function summarizeByStaff(
  orders: CommissionOrder[],
  rules: CommissionRule[],
  linesByOrder: Map<string, CommissionLine[]> = new Map()
): StaffCommission[] {
  const byStaff = new Map<string, StaffCommission>();

  for (const order of orders) {
    if (!isEarning(order)) continue;
    const staff = salesPersonOf(order);
    const row = byStaff.get(staff) ?? { staff, orderCount: 0, revenue: 0, commission: 0 };
    row.orderCount += 1;
    row.revenue += order.discounted_total;
    row.commission += commissionFor(order, rules, linesByOrder.get(order.id) ?? []);
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
