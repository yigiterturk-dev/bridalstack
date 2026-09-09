import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCheckoutPlan } from "../lib/billing.ts";
import { FREE_PACK_IDS } from "../config/modules.ts";
import type { PackId } from "../config/modules.ts";

const FULL = { sales: "price_sales", finance: "price_fin", inventory: "price_inv", pro: "price_pro" };
const EMPTY = { sales: "", finance: "", inventory: "", pro: "" };

test("fiyat yapılandırması eksikken plan DEĞİŞTİRİLMEZ", () => {
  const r = resolveCheckoutPlan(["sales"] as PackId[], EMPTY);
  assert.equal(r.kind, "misconfigured");
  if (r.kind === "misconfigured") assert.deepEqual(r.missing, ["sales"]);
});

test("kısmi eksik fiyat da fail-closed: hiçbiri satılmaz", () => {
  const r = resolveCheckoutPlan(["sales", "finance"] as PackId[], { ...FULL, finance: "" });
  assert.equal(r.kind, "misconfigured");
  if (r.kind === "misconfigured") assert.deepEqual(r.missing, ["finance"]);
});

test("ücretli paket seçilirse checkout kurulur, ücretsizler KORUNUR", () => {
  const r = resolveCheckoutPlan(["sales"] as PackId[], FULL);
  assert.equal(r.kind, "checkout");
  if (r.kind === "checkout") {
    assert.deepEqual(r.lineItems, [{ price: "price_sales", quantity: 1 }]);
    for (const free of FREE_PACK_IDS) assert.ok(r.packs.includes(free), `${free} korunmalı`);
    assert.ok(r.packs.includes("sales" as PackId));
  }
});

test("ücretli paket seçilmezse downgrade: ücretsiz paketlerin TAMAMI kalır", () => {
  const r = resolveCheckoutPlan([] as PackId[], FULL);
  assert.equal(r.kind, "downgrade");
  // Eski hata: sadece ["base"] yazılıyor, ücretsiz salon paketi siliniyordu.
  if (r.kind === "downgrade") assert.deepEqual([...r.packs].sort(), [...FREE_PACK_IDS].sort());
});

test("downgrade ücretsiz paketleri fiyat yokken bile yapabilir", () => {
  const r = resolveCheckoutPlan(["base"] as PackId[], EMPTY);
  assert.equal(r.kind, "downgrade");
});

test("aynı paket iki kez gönderilirse tek satır olur", () => {
  const r = resolveCheckoutPlan(["sales", "sales"] as PackId[], FULL);
  assert.equal(r.kind, "checkout");
  if (r.kind === "checkout") assert.equal(r.lineItems.length, 1);
});
