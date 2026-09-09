import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemoData, DEMO_MARK } from "../lib/demo-data.ts";

const now = new Date("2026-09-09T12:00:00Z");
const data = buildDemoData(now);

test("örnek veri tanınabilir olarak işaretlenir — silinebilmesi buna bağlı", () => {
  for (const c of data.customers) assert.deepEqual(c.metadata, DEMO_MARK);
  for (const p of data.products) assert.deepEqual(p.metadata, DEMO_MARK);
  for (const o of data.orders) assert.deepEqual(o.metadata, DEMO_MARK);
});

test("sipariş toplamları tutarlı: kalan = indirimli toplam − kapora", () => {
  for (const o of data.orders) {
    assert.equal(o.remaining_balance, Number((o.discounted_total - o.deposit_amount).toFixed(2)));
    assert.ok(o.discounted_total <= o.list_total);
    assert.ok(o.deposit_amount <= o.discounted_total);
  }
});

test("sipariş kalemleri siparişin indirimli toplamını besler", () => {
  for (const o of data.orders) {
    const lines = data.orderLines.filter((l) => l.orderRef === o.ref_no);
    if (lines.length === 0) continue;
    const sum = lines.reduce((t, l) => t + l.unit_price * l.quantity, 0);
    assert.equal(Number(sum.toFixed(2)), o.discounted_total);
  }
});

test("sipariş referansları benzersiz, müşteriler gerçek müşteriye işaret eder", () => {
  const refs = data.orders.map((o) => o.ref_no);
  assert.equal(new Set(refs).size, refs.length);
  const names = new Set(data.customers.map((c) => c.name));
  for (const o of data.orders) assert.ok(names.has(o.customerName));
});

test("randevular gelecekte, stok eksiye inmez", () => {
  for (const a of data.appointments) assert.ok(a.appointment_date.getTime() > now.getTime());
  for (const p of data.products) assert.ok(p.stock_quantity >= 0);
});

test("örnek e-postalar gerçek adrese gitmez", () => {
  for (const c of data.customers) assert.match(c.email, /@example\.com$/);
});

test("veri dolu bir mağaza gösterir — boş panel satmaz", () => {
  assert.ok(data.customers.length >= 5);
  assert.ok(data.products.length >= 5);
  assert.ok(data.orders.length >= 3);
  assert.ok(data.appointments.length >= 3);
});
