import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReceivables,
  summarizeAging,
  totalOutstanding,
  type OrderInput,
  type InstallmentInput,
} from "../lib/receivables.ts";

const NOW = new Date("2026-09-02T12:00:00Z");

function order(over: Partial<OrderInput> = {}): OrderInput {
  return {
    id: "o1", ref_no: "S001", customer_id: "c1", status: "confirmed",
    discounted_total: 5000, deposit_amount: 1000, order_date: "2026-06-01",
    created_at: new Date("2026-06-01T10:00:00Z"),
    ...over,
  };
}
function inst(over: Partial<InstallmentInput> = {}): InstallmentInput {
  return { order_id: "o1", amount: 2000, due_date: "2026-10-01", paid_at: null, status: "pending", ...over };
}

test("kapora düşülür, kalan borç doğru", () => {
  const [r] = buildReceivables([order()], [], NOW);
  assert.equal(r.collected, 1000);
  assert.equal(r.outstanding, 4000);
});

test("ödenmiş taksitler tahsilata eklenir", () => {
  const [r] = buildReceivables(
    [order()],
    [inst({ amount: 2000, status: "paid", paid_at: new Date() }), inst({ amount: 2000 })],
    NOW
  );
  assert.equal(r.collected, 3000);
  assert.equal(r.outstanding, 2000);
  assert.equal(r.paidCount, 1);
  assert.equal(r.installmentCount, 2);
});

test("borcu kapanan sipariş listede görünmez", () => {
  const result = buildReceivables([order({ deposit_amount: 5000 })], [], NOW);
  assert.equal(result.length, 0);
});

test("iptal edilmiş sipariş borç sayılmaz", () => {
  assert.equal(buildReceivables([order({ status: "cancelled" })], [], NOW).length, 0);
});

test("iptal edilmiş taksit hesaba katılmaz", () => {
  const [r] = buildReceivables(
    [order()],
    [inst({ amount: 2000, status: "cancelled" })],
    NOW
  );
  assert.equal(r.installmentCount, 0);
  assert.equal(r.outstanding, 4000);
});

test("vadesi gelmemiş borç 'current' kovasında", () => {
  const [r] = buildReceivables([order()], [inst({ due_date: "2026-12-01" })], NOW);
  assert.equal(r.daysOverdue, 0);
  assert.equal(r.bucket, "current");
});

test("gecikme gün sayısı ve kova doğru hesaplanır", () => {
  const cases: [string, number, string][] = [
    ["2026-09-01", 1, "d1_30"],
    ["2026-08-10", 23, "d1_30"],
    ["2026-07-20", 44, "d31_60"],
    ["2026-05-01", 124, "d61_plus"],
  ];
  for (const [due, days, bucket] of cases) {
    const [r] = buildReceivables([order()], [inst({ due_date: due })], NOW);
    assert.equal(r.daysOverdue, days, `${due} için gün sayısı`);
    assert.equal(r.bucket, bucket, `${due} için kova`);
  }
});

test("en eski ödenmemiş taksit gecikmeyi belirler", () => {
  const [r] = buildReceivables(
    [order()],
    [
      inst({ due_date: "2026-07-01", amount: 1000 }),
      inst({ due_date: "2026-12-01", amount: 1000 }),
    ],
    NOW
  );
  assert.equal(r.daysOverdue, 63);
  assert.equal(r.nextDueDate, "2026-07-01");
});

test("ödenmiş taksit gecikmeyi etkilemez", () => {
  const [r] = buildReceivables(
    [order()],
    [
      inst({ due_date: "2026-07-01", amount: 1000, status: "paid", paid_at: new Date() }),
      inst({ due_date: "2026-12-01", amount: 1000 }),
    ],
    NOW
  );
  assert.equal(r.daysOverdue, 0);
  assert.equal(r.nextDueDate, "2026-12-01");
});

test("sıralama: en çok geciken önce", () => {
  const result = buildReceivables(
    [order({ id: "yeni", ref_no: "A" }), order({ id: "eski", ref_no: "B" })],
    [
      inst({ order_id: "yeni", due_date: "2026-09-01" }),
      inst({ order_id: "eski", due_date: "2026-05-01" }),
    ],
    NOW
  );
  assert.deepEqual(result.map((r) => r.ref_no), ["B", "A"]);
});

test("yaşlandırma özeti kovalara göre toplar", () => {
  const receivables = buildReceivables(
    [
      order({ id: "a", ref_no: "A" }),
      order({ id: "b", ref_no: "B", discounted_total: 3000, deposit_amount: 0 }),
    ],
    [
      inst({ order_id: "a", due_date: "2026-12-01" }),
      inst({ order_id: "b", due_date: "2026-05-01" }),
    ],
    NOW
  );
  const s = summarizeAging(receivables);
  assert.equal(s.current.count, 1);
  assert.equal(s.current.amount, 4000);
  assert.equal(s.d61_plus.count, 1);
  assert.equal(s.d61_plus.amount, 3000);
  assert.equal(totalOutstanding(receivables), 7000);
});

test("taksit planı yoksa kapora dışındaki tutar borç kalır", () => {
  const [r] = buildReceivables([order()], [], NOW);
  assert.equal(r.installmentCount, 0);
  assert.equal(r.nextDueDate, null);
  assert.equal(r.outstanding, 4000);
  assert.equal(r.bucket, "current");
});
