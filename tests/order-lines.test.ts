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
  parseDraftLines,
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

// ── Sipariş kurulurken girilen taslak kalemler ────────────────────────────────

const row = (r: Partial<Parameters<typeof parseDraftLines>[0][number]>) => r;

test("boş satırlar atılır — form her zaman bir boş satır gönderir", () => {
  const out = parseDraftLines([
    row({ description: "", unit_price: "", quantity: "1" }),
    row({ description: "   ", product_id: "" }),
  ]);
  assert.equal(out.length, 0);
});

test("adsız ama ürünlü satır kalır; adı sunucu ürün adından doldurur", () => {
  const out = parseDraftLines([row({ product_id: "p1", unit_price: "100" })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].description, "");
  assert.equal(out[0].product_id, "p1");
});

test("adet en az 1, tutarlar eksiye inmez, çöp girdi 0 olur", () => {
  const [line] = parseDraftLines([
    row({ description: "Veil", quantity: "0", unit_price: "-50", discount: "abc" }),
  ]);
  assert.equal(line.quantity, 1);
  assert.equal(line.unit_price, 0);
  assert.equal(line.discount, 0);
});

test("ondalık adet aşağı yuvarlanır, tam sayıya zorlanır", () => {
  const [line] = parseDraftLines([row({ description: "Gown", quantity: "2.9" })]);
  assert.equal(line.quantity, 2);
});

test("bilinmeyen tür şemanın varsayılanına düşer", () => {
  const [a] = parseDraftLines([row({ description: "X", kind: "hack" })]);
  const [b] = parseDraftLines([row({ description: "Y", kind: "veil" })]);
  assert.equal(a.kind, "gown");
  assert.equal(b.kind, "veil");
});

test("sıra korunur ve toplam kalemlerden okunur", () => {
  const out = parseDraftLines([
    row({ description: "Gown", quantity: "1", unit_price: "1000", discount: "100" }),
    row({ description: "", unit_price: "" }),
    row({ description: "Veil", quantity: "2", unit_price: "150" }),
  ]);
  assert.deepEqual(out.map((l) => l.description), ["Gown", "Veil"]);
  assert.deepEqual(derivedOrderTotals(out), { list_total: 1300, discounted_total: 1200 });
});
