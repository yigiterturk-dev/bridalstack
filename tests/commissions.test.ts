import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchRule,
  matchRuleForKind,
  commissionBreakdown,
  commissionFor,
  summarizeByStaff,
  periodOf,
  periodOptions,
  isEarning,
  salesPersonOf,
  UNASSIGNED,
  type CommissionRule,
  type CommissionOrder,
} from "../lib/commissions.ts";

function rule(over: Partial<CommissionRule> = {}): CommissionRule {
  return {
    id: "r1",
    name: "Standard",
    scope: "all",
    staff_name: null,
    rate_percent: 5,
    flat_amount: 0,
    min_order_total: 0,
    priority: 0,
    is_active: true,
    ...over,
  };
}

function order(over: Partial<CommissionOrder> = {}): CommissionOrder {
  return {
    id: "o1",
    ref_no: "ORD-1",
    sales_person: "Ayla",
    status: "confirmed",
    discounted_total: 1000,
    order_date: "2026-09-04",
    created_at: new Date("2026-09-04T10:00:00Z"),
    ...over,
  };
}

test("yüzde primi indirimli tutar üzerinden hesaplanır", () => {
  assert.equal(commissionFor(order(), [rule()]), 50);
});

test("sabit bonus yüzdenin üstüne eklenir", () => {
  assert.equal(commissionFor(order(), [rule({ rate_percent: 5, flat_amount: 25 })]), 75);
});

test("iptal edilen sipariş prim doğurmaz", () => {
  assert.equal(commissionFor(order({ status: "cancelled" }), [rule()]), 0);
  assert.equal(isEarning(order({ status: "draft" })), false);
});

test("kural yoksa prim sıfırdır", () => {
  assert.equal(commissionFor(order(), []), 0);
});

test("alt sınırın altındaki sipariş kurala girmez", () => {
  const r = rule({ min_order_total: 2000 });
  assert.equal(matchRule(order({ discounted_total: 1500 }), [r]), null);
  assert.equal(commissionFor(order({ discounted_total: 1500 }), [r]), 0);
});

test("pasif kural uygulanmaz", () => {
  assert.equal(commissionFor(order(), [rule({ is_active: false })]), 0);
});

test("aynı öncelikte kişiye özel kural genel kuralı yener", () => {
  const genel = rule({ id: "genel", rate_percent: 5 });
  const ozel = rule({ id: "ozel", scope: "staff", staff_name: "Ayla", rate_percent: 8 });
  assert.equal(matchRule(order(), [genel, ozel])?.id, "ozel");
  assert.equal(commissionFor(order(), [genel, ozel]), 80);
});

test("yüksek öncelik, kişiye özel kuralı da geçer", () => {
  const genel = rule({ id: "genel", rate_percent: 10, priority: 5 });
  const ozel = rule({ id: "ozel", scope: "staff", staff_name: "Ayla", rate_percent: 8, priority: 1 });
  assert.equal(matchRule(order(), [genel, ozel])?.id, "genel");
});

test("başkasının kuralı bu siparişe uymaz", () => {
  const ozel = rule({ scope: "staff", staff_name: "Deniz", rate_percent: 20 });
  assert.equal(matchRule(order({ sales_person: "Ayla" }), [ozel]), null);
});

test("isim eşleşmesi büyük/küçük harf ve boşluğa takılmaz", () => {
  const ozel = rule({ scope: "staff", staff_name: " ayla " });
  assert.notEqual(matchRule(order({ sales_person: "Ayla" }), [ozel]), null);
});

test("satışçısı yazılmamış sipariş Unassigned altında toplanır", () => {
  assert.equal(salesPersonOf(order({ sales_person: null })), UNASSIGNED);
  assert.equal(salesPersonOf(order({ sales_person: "   " })), UNASSIGNED);
});

test("özet satışçı bazında toplar ve primi yüksek olan başa gelir", () => {
  const rows = summarizeByStaff(
    [
      order({ id: "a", sales_person: "Ayla", discounted_total: 1000 }),
      order({ id: "b", sales_person: "Ayla", discounted_total: 2000 }),
      order({ id: "c", sales_person: "Deniz", discounted_total: 500 }),
      order({ id: "d", sales_person: "Deniz", status: "cancelled", discounted_total: 9000 }),
    ],
    [rule()]
  );
  assert.deepEqual(
    rows.map((r) => [r.staff, r.orderCount, r.revenue, r.commission]),
    [
      ["Ayla", 2, 3000, 150],
      ["Deniz", 1, 500, 25],
    ]
  );
});

test("dönem sipariş tarihinden gelir, yoksa kayıt anından", () => {
  assert.equal(periodOf(order({ order_date: "2026-07-15" })), "2026-07");
  assert.equal(
    periodOf(order({ order_date: null, created_at: new Date("2026-03-02T00:00:00Z") })),
    "2026-03"
  );
});

test("dönem listesi yeniden eskiye sıralı ve bu ayı her zaman içerir", () => {
  const now = new Date("2026-09-15T00:00:00Z");
  const list = periodOptions([order({ order_date: "2026-07-01" })], now);
  assert.deepEqual(list, ["2026-09", "2026-07"]);
});

// ── Kalem bazlı prim kuralları ────────────────────────────────────────────────

const kindRule = (over: Partial<import("../lib/commissions.ts").CommissionRule> = {}) => ({
  id: "k",
  name: "Kind rule",
  scope: "all",
  staff_name: null,
  applies_to: "kind",
  line_kind: "gown",
  rate_percent: 8,
  flat_amount: 0,
  min_order_total: 0,
  priority: 0,
  is_active: true,
  ...over,
});

const gownLine = { kind: "gown", quantity: 1, unit_price: 3000, discount: 0 };
const veilLine = { kind: "veil", quantity: 2, unit_price: 250, discount: 0 };
const altLine = { kind: "alteration", quantity: 1, unit_price: 200, discount: 0 };
const withLines = order({ discounted_total: 3700 });

test("tür kuralı yoksa kalemler hesabı değiştirmez — eski davranış korunur", () => {
  assert.equal(commissionFor(withLines, [rule({ rate_percent: 5 })], [gownLine, veilLine]), 185);
});

test("kalemi olmayan sipariş tür kuralı varken de eski yoldan hesaplanır", () => {
  assert.equal(commissionFor(order({ discounted_total: 1000 }), [rule({ rate_percent: 5 }), kindRule()], []), 50);
});

test("tür kuralı yalnız kendi kalemine uygulanır", () => {
  // Elbise 3000 × %8 = 240. Duvağa kural yok → 0.
  assert.equal(commissionFor(withLines, [kindRule()], [gownLine, veilLine]), 240);
});

test("genel kural ile tür kuralı TOPLANMAZ — en özel olan kalemi tek başına belirler", () => {
  // Elbise 3000 × %8 = 240 (tür kuralı), duvak 500 × %5 = 25 (genel kural).
  const total = commissionFor(withLines, [rule({ rate_percent: 5 }), kindRule()], [gownLine, veilLine]);
  assert.equal(total, 265);
});

test("farklı türlerin kuralları toplanır", () => {
  const rules = [kindRule({ id: "g", line_kind: "gown", rate_percent: 10 }), kindRule({ id: "a", line_kind: "alteration", rate_percent: 50 })];
  // 3000 × %10 = 300, tadilat 200 × %50 = 100, duvağa kural yok.
  assert.equal(commissionFor(withLines, rules, [gownLine, veilLine, altLine]), 400);
});

test("tür + satışçı kuralı yalın tür kuralını yener", () => {
  const genelTur = kindRule({ id: "tur", rate_percent: 8 });
  const ozelTur = kindRule({ id: "ozel", scope: "staff", staff_name: "Ayşe", rate_percent: 10 });
  const o = order({ sales_person: "Ayşe", discounted_total: 3000 });
  assert.equal(matchRuleForKind(o, [genelTur, ozelTur], "gown")?.id, "ozel");
  assert.equal(commissionFor(o, [genelTur, ozelTur], [gownLine]), 300);
});

test("öncelik özgüllüğü yener", () => {
  const genel = rule({ id: "genel", rate_percent: 5, priority: 9 });
  const tur = kindRule({ id: "tur", rate_percent: 8, priority: 1 });
  assert.equal(matchRuleForKind(order(), [genel, tur], "gown")?.id, "genel");
});

test("sabit bonus sipariş başınadır, tür başına çoğalmaz", () => {
  const rules = [
    rule({ rate_percent: 0, flat_amount: 100 }),
    kindRule({ id: "g", line_kind: "gown", rate_percent: 10 }),
    kindRule({ id: "v", line_kind: "veil", rate_percent: 10 }),
  ];
  // 300 + 50 + tek sefer 100 = 450 (iki kez 100 değil).
  assert.equal(commissionFor(withLines, rules, [gownLine, veilLine]), 450);
});

test("alt sınır kalem toplamına değil sipariş toplamına bakar", () => {
  const r = kindRule({ min_order_total: 5000 });
  assert.equal(matchRuleForKind(order({ discounted_total: 3700 }), [r], "gown"), null);
  assert.equal(commissionFor(withLines, [r], [gownLine]), 0);
});

test("iptal edilen sipariş kalemli kuralla da prim doğurmaz", () => {
  assert.equal(commissionFor(order({ status: "cancelled" }), [kindRule()], [gownLine]), 0);
});

test("kalem indirimi prim tabanını düşürür", () => {
  const indirimli = { kind: "gown", quantity: 1, unit_price: 3000, discount: 500 };
  assert.equal(commissionFor(withLines, [kindRule({ rate_percent: 10 })], [indirimli]), 250);
});

test("döküm her türün hangi kuraldan ne kazandırdığını gösterir", () => {
  const rows = commissionBreakdown(withLines, [rule({ rate_percent: 5 }), kindRule()], [gownLine, veilLine]);
  const gown = rows.find((r) => r.kind === "gown");
  const veil = rows.find((r) => r.kind === "veil");
  assert.equal(gown?.rule?.id, "k");
  assert.equal(gown?.amount, 240);
  assert.equal(veil?.rule?.id, "r1");
  assert.equal(veil?.amount, 25);
  assert.equal(rows.reduce((s, r) => s + r.amount, 0), 265);
});

test("satışçı özeti kalem kurallarını da toplar", () => {
  const o = order({ id: "o1", sales_person: "Ayşe", discounted_total: 3500 });
  const lines = new Map([["o1", [gownLine, veilLine]]]);
  const rows = summarizeByStaff([o], [kindRule({ rate_percent: 10 })], lines);
  assert.equal(rows[0].commission, 300);
});

test("tür kuralı pasifse kalemi genel kurala düşer", () => {
  const total = commissionFor(withLines, [rule({ rate_percent: 5 }), kindRule({ is_active: false })], [gownLine]);
  assert.equal(total, 150);
});
