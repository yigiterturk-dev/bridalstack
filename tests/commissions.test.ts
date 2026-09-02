import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchRule,
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
