import assert from "node:assert/strict";
import test from "node:test";
import { billingConfiguredFrom, packForProductIdFrom, productIdsFrom } from "../lib/dodo-config.ts";

/**
 * Ödeme hattı yapılandırması.
 *
 * Eksik bir ürün kimliği, müşteriyi ürünü olmayan bir checkout'a sokar.
 * Tek bir eksikte hat KAPALI olmalı; "yarım çalışan" bir ödeme akışı yok.
 */

const FULL = {
  DODO_PAYMENTS_API_KEY: "dodo_live_key",
  DODO_PAYMENTS_WEBHOOK_KEY: "whsec_test",
  DODO_PRODUCT_SALES: "pdt_sales",
  DODO_PRODUCT_FINANCE: "pdt_finance",
  DODO_PRODUCT_INVENTORY: "pdt_inventory",
  DODO_PRODUCT_PRO: "pdt_pro",
} as const;

test("hepsi varsa ödeme hattı açık", () => {
  assert.equal(billingConfiguredFrom(FULL), true);
});

test("tek eksik ürün kimliği hattı kapatır", () => {
  for (const key of ["DODO_PRODUCT_SALES", "DODO_PRODUCT_FINANCE", "DODO_PRODUCT_INVENTORY", "DODO_PRODUCT_PRO"] as const) {
    assert.equal(billingConfiguredFrom({ ...FULL, [key]: "" }), false, key);
  }
});

test("API anahtarı veya webhook sırrı yoksa hat kapalı", () => {
  assert.equal(billingConfiguredFrom({ ...FULL, DODO_PAYMENTS_API_KEY: "" }), false);
  assert.equal(billingConfiguredFrom({ ...FULL, DODO_PAYMENTS_WEBHOOK_KEY: "" }), false);
});

test("ürün kimlikleri kırpılır ve paketlere eşlenir", () => {
  const ids = productIdsFrom({ ...FULL, DODO_PRODUCT_SALES: "  pdt_sales  " });
  assert.equal(ids.sales, "pdt_sales");
  assert.equal(packForProductIdFrom("pdt_sales", FULL), "sales");
  assert.equal(packForProductIdFrom("pdt_finance", FULL), "finance");
  assert.equal(packForProductIdFrom("pdt_inventory", FULL), "inventory");
  assert.equal(packForProductIdFrom("pdt_pro", FULL), "pro");
});

test("bilinmeyen veya boş ürün kimliği pakete eşlenmez", () => {
  assert.equal(packForProductIdFrom("pdt_unknown", FULL), null);
  assert.equal(packForProductIdFrom("", FULL), null);
  assert.equal(packForProductIdFrom("pdt_sales", { ...FULL, DODO_PRODUCT_SALES: "" }), null);
});
