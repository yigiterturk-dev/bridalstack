import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canCancel,
  canCloseShort,
  canReceive,
  clampReceived,
  expectedFromLeadTime,
  isEditable,
  isLate,
  receiveDelta,
  shouldPostCost,
  statusAfterReceipt,
  summarize,
} from "../lib/purchasing.ts";

const line = (ordered: number, received: number, cost = 100) => ({
  ordered_qty: ordered,
  received_qty: received,
  unit_cost: cost,
});

// ── Mal kabulü ────────────────────────────────────────────────────────────────

test("sipariş edilenden fazlası kabul edilemez", () => {
  assert.equal(clampReceived(line(3, 0), 5), 3);
  assert.equal(receiveDelta(line(3, 0), 5), 3);
});

test("teslim adedi geriye alınamaz", () => {
  assert.equal(clampReceived(line(3, 2), 1), 2);
  assert.equal(receiveDelta(line(3, 2), 1), 0);
});

test("rafa yalnız aradaki fark girer — ikinci kez teslim alma stoğu şişirmez", () => {
  assert.equal(receiveDelta(line(5, 2), 4), 2);
  assert.equal(receiveDelta(line(5, 4), 4), 0);
});

test("geçersiz giriş adedi değiştirmez", () => {
  assert.equal(clampReceived(line(3, 1), Number.NaN), 1);
});

test("ondalık adet en yakın tam sayıya çekilir", () => {
  assert.equal(clampReceived(line(5, 0), 2.6), 3);
});

// ── Toplamlar ─────────────────────────────────────────────────────────────────

test("kasaya yazılan tutar sipariş edilenin değil teslim alınanın maliyetidir", () => {
  const s = summarize([line(3, 1, 200), line(2, 2, 50)]);
  assert.equal(s.orderedCost, 700);
  assert.equal(s.receivedCost, 300);
  assert.equal(s.outstandingUnits, 2);
  assert.equal(s.complete, false);
});

test("boş sipariş tamamlanmış sayılmaz", () => {
  assert.equal(summarize([]).complete, false);
});

// ── Durum ─────────────────────────────────────────────────────────────────────

test("durum kalemlerden okunur, elle seçilmez", () => {
  assert.equal(statusAfterReceipt([line(3, 3), line(2, 2)]), "received");
  assert.equal(statusAfterReceipt([line(3, 1), line(2, 0)]), "partial");
  assert.equal(statusAfterReceipt([line(3, 0), line(2, 0)]), "ordered");
});

test("yalnız taslak sipariş düzenlenir, yola çıkan dondurulur", () => {
  assert.equal(isEditable("draft"), true);
  assert.equal(isEditable("ordered"), false);
});

test("taslağa mal kabul edilemez", () => {
  assert.equal(canReceive("draft"), false);
  assert.equal(canReceive("ordered"), true);
  assert.equal(canReceive("partial"), true);
  assert.equal(canReceive("received"), false);
});

test("tek adet mal girdiyse sipariş iptal edilemez", () => {
  assert.equal(canCancel("ordered", [line(3, 0)]), true);
  assert.equal(canCancel("partial", [line(3, 1)]), false);
  assert.equal(canCancel("received", [line(3, 3)]), false);
});

test("eksik gelen sipariş elle kapatılabilir, tam gelen zaten kapanır", () => {
  assert.equal(canCloseShort("partial", [line(3, 1)]), true);
  assert.equal(canCloseShort("partial", [line(3, 3)]), false);
  assert.equal(canCloseShort("ordered", [line(3, 0)]), false);
});

// ── Para ──────────────────────────────────────────────────────────────────────

test("sipariş vermek para harcamak değildir", () => {
  assert.equal(shouldPostCost("ordered", [line(3, 0, 200)]), false);
  assert.equal(shouldPostCost("partial", [line(3, 1, 200)]), false);
  assert.equal(shouldPostCost("received", [line(3, 3, 200)]), true);
});

test("bedelsiz teslim kasaya kayıt doğurmaz", () => {
  assert.equal(shouldPostCost("received", [line(3, 3, 0)]), false);
});

// ── Tarih ─────────────────────────────────────────────────────────────────────

test("beklenen tarih tedarikçinin teslim süresinden çıkar", () => {
  assert.equal(expectedFromLeadTime("2026-08-30", 5), "2026-09-04");
  assert.equal(expectedFromLeadTime("2026-09-02", null), null);
  assert.equal(expectedFromLeadTime("2026-09-02", 0), null);
});

test("yalnız açık ve eksik sipariş gecikmiş sayılır", () => {
  assert.equal(isLate({ status: "ordered", expected_on: "2026-09-01" }, [line(3, 0)], "2026-09-02"), true);
  assert.equal(isLate({ status: "ordered", expected_on: "2026-09-02" }, [line(3, 0)], "2026-09-02"), false);
  assert.equal(isLate({ status: "partial", expected_on: "2026-01-01" }, [line(3, 3)], "2026-09-02"), false);
  assert.equal(isLate({ status: "received", expected_on: "2026-01-01" }, [line(3, 3)], "2026-09-02"), false);
  assert.equal(isLate({ status: "ordered", expected_on: null }, [line(3, 0)], "2026-09-02"), false);
});
