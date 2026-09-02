import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedTransitions,
  canTransition,
  daysBetween,
  findConflict,
  isOverdue,
  isValidRange,
  lateDays,
  lateFee,
  outstandingLateFee,
  overlaps,
  returnRestockUnits,
  stockDelta,
} from "../lib/rentals.ts";

// ── Takvim çakışması ──────────────────────────────────────────────────────────

test("sınırlar dahil çakışır — aynı gün iki geline söz verilemez", () => {
  assert.equal(overlaps({ start_date: "2026-09-10", due_date: "2026-09-12" }, { start_date: "2026-09-12", due_date: "2026-09-14" }), true);
});

test("ardışık ama ayrık aralıklar çakışmaz", () => {
  assert.equal(overlaps({ start_date: "2026-09-10", due_date: "2026-09-12" }, { start_date: "2026-09-13", due_date: "2026-09-14" }), false);
});

test("iptal ve dönmüş kiralama takvimi kapatmaz", () => {
  const existing = [
    { id: "a", product_id: "p1", status: "cancelled", start_date: "2026-09-10", due_date: "2026-09-14" },
    { id: "b", product_id: "p1", status: "returned", start_date: "2026-09-10", due_date: "2026-09-14" },
  ];
  const candidate = { product_id: "p1", status: "reserved", start_date: "2026-09-11", due_date: "2026-09-13" };
  assert.equal(findConflict(existing, candidate), null);
});

test("rezerve edilmiş elbise aynı günlerde ikinci kez verilemez", () => {
  const existing = [{ id: "a", product_id: "p1", status: "reserved", start_date: "2026-09-10", due_date: "2026-09-14" }];
  const clash = findConflict(existing, { product_id: "p1", status: "reserved", start_date: "2026-09-13", due_date: "2026-09-20" });
  assert.equal(clash?.id, "a");
});

test("başka elbisenin kaydı çakışma saymaz", () => {
  const existing = [{ id: "a", product_id: "p2", status: "out", start_date: "2026-09-10", due_date: "2026-09-14" }];
  assert.equal(findConflict(existing, { product_id: "p1", status: "reserved", start_date: "2026-09-11", due_date: "2026-09-12" }), null);
});

test("kayıt kendini engellemez", () => {
  const existing = [{ id: "a", product_id: "p1", status: "reserved", start_date: "2026-09-10", due_date: "2026-09-14" }];
  assert.equal(findConflict(existing, { id: "a", product_id: "p1", status: "reserved", start_date: "2026-09-11", due_date: "2026-09-15" }), null);
});

test("dönüş günü çıkıştan önce olamaz", () => {
  assert.equal(isValidRange({ start_date: "2026-09-14", due_date: "2026-09-10" }), false);
  assert.equal(isValidRange({ start_date: "2026-09-10", due_date: "2026-09-10" }), true);
  assert.equal(isValidRange({ start_date: "14/09/2026", due_date: "2026-09-20" }), false);
});

// ── Durum ve stok ─────────────────────────────────────────────────────────────

test("kiralama durum geçişleri tek yönlüdür", () => {
  assert.deepEqual(allowedTransitions("reserved"), ["out", "cancelled"]);
  assert.deepEqual(allowedTransitions("out"), ["returned"]);
  assert.deepEqual(allowedTransitions("returned"), []);
  assert.equal(canTransition("returned", "out"), false);
  assert.equal(canTransition("out", "cancelled"), false);
});

test("rezervasyon stoğu azaltmaz, teslim azaltır", () => {
  assert.equal(stockDelta("reserved", "reserved"), 0);
  assert.equal(stockDelta("reserved", "cancelled"), 0);
  assert.equal(stockDelta("reserved", "out"), -1);
});

test("kirli dönen elbise doğrudan rafa girmez", () => {
  assert.equal(returnRestockUnits(true), 0);
  assert.equal(returnRestockUnits(false), 1);
});

// ── Gecikme ───────────────────────────────────────────────────────────────────

test("gün farkı ay sınırını doğru geçer", () => {
  assert.equal(daysBetween("2026-08-30", "2026-09-02"), 3);
  assert.equal(daysBetween("2026-09-02", "2026-09-02"), 0);
});

test("söz verilen gün geç sayılmaz", () => {
  const rental = { status: "out", due_date: "2026-09-10", late_fee_per_day: 25 };
  assert.equal(lateDays(rental, "2026-09-10"), 0);
  assert.equal(lateDays(rental, "2026-09-13"), 3);
});

test("dönmüş kiralamada bugün değil fiili dönüş günü ölçülür", () => {
  const rental = { status: "returned", due_date: "2026-09-10", returned_on: "2026-09-11", late_fee_per_day: 25 };
  assert.equal(lateDays(rental, "2026-09-30"), 1);
  assert.equal(lateFee(rental, "2026-09-30"), 25);
});

test("iptal edilen kiralama gecikme doğurmaz", () => {
  assert.equal(lateDays({ status: "cancelled", due_date: "2026-01-01", late_fee_per_day: 50 }, "2026-09-02"), 0);
});

test("günlük ücret sıfırsa gecikme bedeli çıkmaz", () => {
  assert.equal(lateFee({ status: "out", due_date: "2026-09-01", late_fee_per_day: 0 }, "2026-09-10"), 0);
});

test("yalnız dışarıdaki kiralama geciker sayılır", () => {
  assert.equal(isOverdue({ status: "reserved", due_date: "2026-01-01" }, "2026-09-02"), false);
  assert.equal(isOverdue({ status: "out", due_date: "2026-01-01" }, "2026-09-02"), true);
});

test("tahsil edilen gecikme bedeli bir daha istenmez", () => {
  const rental = { status: "out", due_date: "2026-09-01", late_fee_per_day: 20, late_fee_collected: 0 };
  assert.equal(outstandingLateFee(rental, "2026-09-04"), 60);
  assert.equal(outstandingLateFee({ ...rental, late_fee_collected: 60 }, "2026-09-04"), 0);
});

test("gecikme sürerse yalnız yeni biriken tutar istenir", () => {
  const rental = { status: "out", due_date: "2026-09-01", late_fee_per_day: 20, late_fee_collected: 60 };
  assert.equal(outstandingLateFee(rental, "2026-09-06"), 40);
});

test("fazla tahsil edilmişse eksi tutar çıkmaz", () => {
  const rental = { status: "returned", due_date: "2026-09-01", returned_on: "2026-09-02", late_fee_per_day: 20, late_fee_collected: 100 };
  assert.equal(outstandingLateFee(rental, "2026-09-30"), 0);
});
