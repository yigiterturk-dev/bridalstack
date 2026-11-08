import { test } from "node:test";
import assert from "node:assert/strict";
import { PACKS, SELLABLE_PACK_IDS, ANNUAL_BILLING_MONTHS, annualPrice, calculateAnnualPrice, calculateMonthlyPrice, isPackSellable, formatPrice } from "../config/modules.ts";

/**
 * ABD gelinlik yazılımı pazarı (Eylül 2026 araştırması):
 *   CloudBridal          $80 / $120 / $180, eklenti yok
 *   BridalLive           ~$199 taban, üstü $499+; müşteri portalı +$110,
 *                        itibar yönetimi +$119, smokin +$99, API +$50
 *   Bağımsız butik için gerçekçi hepsi dahil aralık: $80–$400
 *
 * BridalStack'in konumu bilinçli olarak bu aralığın ALTINDA: marka bilinirliği
 * yok, o yüzden fiyat giriş silahı. Bu test fiyatların sessizce piyasa
 * seviyesine kaymasını engeller.
 */
const MARKET_ENTRY_CEILING = 80; // en ucuz rakibin giriş planı
const ALL_IN_CEILING = 120; // en ucuz rakibin orta planı

test("ücretsiz katman gerçekten ücretsiz", () => {
  assert.equal(PACKS.base.monthlyPrice, 0);
  assert.equal(PACKS.salon.monthlyPrice, 0);
});

test("ücretsiz katman satın alınamaz (zaten herkeste)", () => {
  assert.equal(isPackSellable("base"), false);
});

test("hiçbir tek paket rakiplerin giriş planından pahalı değil", () => {
  for (const id of SELLABLE_PACK_IDS) {
    assert.ok(
      PACKS[id].monthlyPrice < MARKET_ENTRY_CEILING,
      `${id} paketi $${PACKS[id].monthlyPrice} — rakip giriş planı $${MARKET_ENTRY_CEILING} altında kalmalı`
    );
  }
});

test("satılabilir her şeyin toplamı rakiplerin orta planının altında", () => {
  const total = calculateMonthlyPrice(SELLABLE_PACK_IDS);
  assert.ok(
    total < ALL_IN_CEILING,
    `hepsi dahil $${total} — $${ALL_IN_CEILING} altında kalmalı`
  );
});

test("fiyat toplama base'i saymıyor", () => {
  assert.equal(calculateMonthlyPrice(["base"]), 0);
  assert.equal(
    calculateMonthlyPrice(["base", "sales"]),
    PACKS.sales.monthlyPrice
  );
});

test("satılabilir paket listesi boş değil", () => {
  assert.ok(SELLABLE_PACK_IDS.length >= 3, SELLABLE_PACK_IDS.join(", "));
});

test("negatif tutarda eksi işareti para biriminin önünde", () => {
  assert.equal(formatPrice(-250), "−$250");
  assert.equal(formatPrice(250), "$250");
  assert.equal(formatPrice(0), "$0");
});

test("yıllık plan 12 ayın bedeli 10 aydır (2 ay bedava)", () => {
  for (const id of SELLABLE_PACK_IDS) {
    assert.equal(annualPrice(PACKS[id].monthlyPrice), PACKS[id].monthlyPrice * ANNUAL_BILLING_MONTHS, id);
  }
  assert.equal(calculateAnnualPrice(SELLABLE_PACK_IDS), calculateMonthlyPrice(SELLABLE_PACK_IDS) * ANNUAL_BILLING_MONTHS);
});

test("formatPrice: kesirli tutarda iki hane, tamda hiç", () => {
  assert.equal(formatPrice(2971.5), "$2,971.50");
  assert.equal(formatPrice(2740), "$2,740");
  assert.equal(formatPrice(-250), "−$250");
  assert.equal(formatPrice(0.1 + 0.2), "$0.30");
});
