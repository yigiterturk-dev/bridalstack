import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canClose,
  carryOver,
  drawerNet,
  expectedClose,
  expectedFor,
  summarizeSessions,
  touchesDrawer,
  variance,
  varianceMovement,
  verdict,
} from "../lib/cash-session.ts";

const cash = (direction: string, amount: number) => ({ direction, amount, method: "cash" });
const card = (direction: string, amount: number) => ({ direction, amount, method: "card" });

// ── Çekmecede sadece nakit vardır ─────────────────────────────────────────────

test("kart, havale ve çek çekmeceye girmez", () => {
  assert.equal(touchesDrawer(cash("in", 100)), true);
  assert.equal(touchesDrawer(card("in", 100)), false);
  assert.equal(touchesDrawer({ direction: "in", amount: 100, method: "transfer" }), false);
  assert.equal(touchesDrawer({ direction: "in", amount: 100, method: "check" }), false);
});

test("kartla geçen tahsilat gün sonu sayımını şişirmez", () => {
  assert.equal(drawerNet([cash("in", 500), card("in", 3000)]), 500);
});

test("nakit gider çekmeceden düşer", () => {
  assert.equal(drawerNet([cash("in", 500), cash("out", 120)]), 380);
});

test("eksi girilmiş tutar yön kuralını bozmaz", () => {
  assert.equal(drawerNet([cash("out", -50)]), -50);
});

test("beklenen kapanış açılış parası artı gün içi nakit", () => {
  assert.equal(expectedClose(300, [cash("in", 500), card("in", 3000), cash("out", 120)]), 680);
});

// ── Dondurma ──────────────────────────────────────────────────────────────────

test("kapanmış oturumun beklediği tutar dondurulmuştur", () => {
  const closed = { status: "closed", opening_float: 300, counted_close: 700, expected_close: 680 };
  // O güne sonradan 5000 nakit girilse bile geçmiş sayım değişmez.
  assert.equal(expectedFor(closed, [cash("in", 5000)]), 680);
  assert.equal(variance(closed, [cash("in", 5000)]), 20);
});

test("açık oturumun beklediği tutar anlık hesaplanır", () => {
  const open = { status: "open", opening_float: 300, counted_close: null, expected_close: null };
  assert.equal(expectedFor(open, [cash("in", 200)]), 500);
});

// ── Fark ──────────────────────────────────────────────────────────────────────

test("sayılmamış oturumun farkı yoktur", () => {
  const open = { status: "open", opening_float: 300, counted_close: null, expected_close: null };
  assert.equal(variance(open, []), null);
  assert.equal(verdict(null), "uncounted");
});

test("fazla ve eksik ayrılır", () => {
  assert.equal(verdict(0), "exact");
  assert.equal(verdict(25), "over");
  assert.equal(verdict(-25), "short");
});

test("eksik para gider, fazla para gelir olarak yazılır", () => {
  assert.deepEqual(varianceMovement(-40), { direction: "out", amount: 40 });
  assert.deepEqual(varianceMovement(40), { direction: "in", amount: 40 });
});

test("tam tutan sayım kasaya kayıt doğurmaz", () => {
  assert.equal(varianceMovement(0), null);
  assert.equal(varianceMovement(null), null);
});

// ── Devir ─────────────────────────────────────────────────────────────────────

test("yeni gün dünkü sayımla açılır", () => {
  assert.equal(carryOver({ status: "closed", opening_float: 300, counted_close: 680, expected_close: 680 }), 680);
});

test("dünkü oturum yoksa sıfırdan başlanır", () => {
  assert.equal(carryOver(null), 0);
  assert.equal(carryOver({ status: "open", opening_float: 300, counted_close: null, expected_close: null }), 0);
});

test("eksi sayım devre taşınmaz", () => {
  assert.equal(carryOver({ status: "closed", opening_float: 0, counted_close: -50, expected_close: 0 }), 0);
});

test("kapanmış oturum yeniden kapatılamaz", () => {
  assert.equal(canClose("open"), true);
  assert.equal(canClose("closed"), false);
});

// ── Dönem raporu ──────────────────────────────────────────────────────────────

const day = (business_date: string, counted: number | null, expected: number | null) => ({
  business_date,
  status: counted === null ? "open" : "closed",
  opening_float: 0,
  counted_close: counted,
  expected_close: expected,
});

test("rapor tam tutan, fazla ve eksik günleri ayırır", () => {
  const r = summarizeSessions([
    day("2026-09-01", 500, 500),
    day("2026-09-02", 480, 500),
    day("2026-09-03", 515, 500),
    day("2026-09-04", null, null),
  ]);
  assert.equal(r.days, 4);
  assert.equal(r.counted, 3);
  assert.equal(r.exact, 1);
  assert.equal(r.short, 1);
  assert.equal(r.over, 1);
});

test("net fark yönleri götürür, mutlak fark götürmez", () => {
  const r = summarizeSessions([day("2026-09-02", 480, 500), day("2026-09-03", 520, 500)]);
  assert.equal(r.netVariance, 0);
  assert.equal(r.absVariance, 40);
});

test("en büyük sapma yönü ne olursa olsun bulunur", () => {
  const r = summarizeSessions([day("2026-09-02", 490, 500), day("2026-09-03", 560, 500)]);
  assert.equal(r.worst?.business_date, "2026-09-03");
});

test("hiç sayım yoksa rapor boş döner", () => {
  const r = summarizeSessions([day("2026-09-04", null, null)]);
  assert.equal(r.counted, 0);
  assert.equal(r.worst, null);
  assert.equal(r.netVariance, 0);
});
