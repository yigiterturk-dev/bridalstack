import { test } from "node:test";
import assert from "node:assert/strict";
import {
  variance,
  summarizeCount,
  closingQuantity,
  restockUnits,
  needsCleaningJob,
  allowedTransitions,
  canTransition,
} from "../lib/inventory.ts";

// ── Sayım farkları ────────────────────────────────────────────────────────────

test("sayılmamış kalemin farkı null", () => {
  assert.equal(variance({ expected_qty: 3, counted_qty: null }), null);
});

test("eksik ve fazla farkı işaretiyle döner", () => {
  assert.equal(variance({ expected_qty: 5, counted_qty: 3 }), -2);
  assert.equal(variance({ expected_qty: 5, counted_qty: 7 }), 2);
  assert.equal(variance({ expected_qty: 5, counted_qty: 5 }), 0);
});

test("özet sadece sayılan kalemleri hesaba katar", () => {
  const s = summarizeCount([
    { expected_qty: 5, counted_qty: 3 }, // -2 eksik
    { expected_qty: 2, counted_qty: 4 }, // +2 fazla
    { expected_qty: 1, counted_qty: 1 }, // tam
    { expected_qty: 9, counted_qty: null }, // sayılmadı
  ]);
  assert.equal(s.total, 4);
  assert.equal(s.counted, 3);
  assert.equal(s.pending, 1);
  assert.equal(s.short, 1);
  assert.equal(s.over, 1);
  assert.equal(s.exact, 1);
  assert.equal(s.netUnits, 0);
  assert.equal(s.accuracy, 33);
});

test("hiç sayım girilmemişse isabet oranı null", () => {
  const s = summarizeCount([{ expected_qty: 4, counted_qty: null }]);
  assert.equal(s.accuracy, null);
  assert.equal(s.netUnits, 0);
});

test("kapanışta sayılmamış kalemin stoğu değişmez", () => {
  assert.equal(closingQuantity({ expected_qty: 4, counted_qty: null }), null);
});

test("sıfır sayılan kalem sıfıra çekilir, boş bırakılanla karışmaz", () => {
  assert.equal(closingQuantity({ expected_qty: 4, counted_qty: 0 }), 0);
});

// ── İade kuralları ────────────────────────────────────────────────────────────

test("hasarlı mal işaret kutusu açık olsa da rafa dönmez", () => {
  assert.equal(restockUnits({ quantity: 2, condition: "damaged", restock: true }), 0);
});

test("temizlik isteyen mal doğrudan rafa dönmez, temizlemeye gider", () => {
  const line = { quantity: 1, condition: "needs_cleaning", restock: true };
  assert.equal(restockUnits(line), 0);
  assert.equal(needsCleaningJob(line), true);
});

test("hasarlı mal temizleme işi de doğurmaz", () => {
  assert.equal(needsCleaningJob({ quantity: 1, condition: "damaged", restock: true }), false);
});

test("rafa dönmeyecek mal temizleme işi doğurmaz", () => {
  assert.equal(needsCleaningJob({ quantity: 1, condition: "needs_cleaning", restock: false }), false);
});

test("restock kapalıysa hiçbir şey dönmez", () => {
  assert.equal(restockUnits({ quantity: 3, condition: "resellable", restock: false }), 0);
});

test("iade durum geçişleri tek yönlüdür", () => {
  assert.deepEqual(allowedTransitions("pending"), ["approved", "rejected"]);
  assert.deepEqual(allowedTransitions("approved"), ["completed", "rejected"]);
  assert.deepEqual(allowedTransitions("completed"), []);
  assert.equal(canTransition("pending", "completed"), false);
  assert.equal(canTransition("completed", "pending"), false);
  assert.equal(canTransition("approved", "completed"), true);
});
