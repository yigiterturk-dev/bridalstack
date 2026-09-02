import { test } from "node:test";
import assert from "node:assert/strict";
import {
  derivedOrderTotals,
  derivesFromLines,
  kindLabel,
  lineDiscount,
  lineGross,
  lineNet,
  remainingBalance,
  totals,
  totalsByKind,
} from "../lib/order-lines.ts";

const l = (quantity: number, unit_price: number, discount = 0, kind = "gown") => ({
  quantity,
  unit_price,
  discount,
  kind,
});

// ── Tek kalem ─────────────────────────────────────────────────────────────────

test("kalem tutarı adet × fiyat", () => {
  assert.equal(lineGross(l(2, 1250)), 2500);
  assert.equal(lineNet(l(2, 1250)), 2500);
});

test("indirim kalemden düşer", () => {
  assert.equal(lineNet(l(1, 2000, 300)), 1700);
  assert.equal(lineDiscount(l(1, 2000, 300)), 300);
});

test("indirim kalemi eksiye düşüremez — diğer kalemlerin parasını yemez", () => {
  assert.equal(lineNet(l(1, 500, 900)), 0);
  assert.equal(lineDiscount(l(1, 500, 900)), 500);
});

test("eksi adet ve eksi fiyat sıfır sayılır", () => {
  assert.equal(lineGross(l(-3, 100)), 0);
  assert.equal(lineGross(l(2, -100)), 0);
});

test("kuruşlar yuvarlanır, kayan nokta artığı taşmaz", () => {
  assert.equal(lineNet(l(3, 19.99)), 59.97);
  assert.equal(totals([l(3, 0.1), l(1, 0.2)]).net, 0.5);
});

// ── Sipariş toplamı ───────────────────────────────────────────────────────────

test("toplam kalemlerden hesaplanır", () => {
  const t = totals([l(1, 3000, 200), l(2, 150), l(1, 400)]);
  assert.equal(t.list, 3700);
  assert.equal(t.net, 3500);
  assert.equal(t.discount, 200);
  assert.equal(t.units, 4);
  assert.equal(t.lines, 3);
});

test("boş sipariş sıfır toplam verir", () => {
  const t = totals([]);
  assert.equal(t.net, 0);
  assert.equal(t.lines, 0);
});

test("tür bazında kırılım prim kurallarına hazır", () => {
  const by = totalsByKind([l(1, 3000, 0, "gown"), l(1, 250, 0, "veil"), l(1, 150, 50, "alteration")]);
  assert.deepEqual(by, { gown: 3000, veil: 250, alteration: 100 });
});

// ── Eski siparişler bozulmaz ──────────────────────────────────────────────────

test("kalemsiz sipariş elle girilen toplamını korur", () => {
  assert.equal(derivesFromLines(0), false);
  assert.equal(derivedOrderTotals([]), null);
});

test("tek kalem bile varsa toplam kalemlerden okunur", () => {
  assert.equal(derivesFromLines(1), true);
  assert.deepEqual(derivedOrderTotals([l(1, 2000, 250)]), {
    list_total: 2000,
    discounted_total: 1750,
  });
});

// ── Bakiye ────────────────────────────────────────────────────────────────────

test("bakiye kapora ve ödenen taksitler düşülerek çıkar", () => {
  assert.equal(remainingBalance(3500, 1000), 2500);
});

test("fazla tahsilat bakiyeyi eksiye indirmez", () => {
  assert.equal(remainingBalance(3500, 4000), 0);
});

test("bilinmeyen kalem türü ham kimliğiyle gösterilir", () => {
  assert.equal(kindLabel("veil"), "Veil");
  assert.equal(kindLabel("mystery"), "mystery");
});
