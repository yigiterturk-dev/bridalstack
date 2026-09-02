import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signedAmount,
  summarize,
  groupByCategory,
  groupByMethod,
  dailyTotals,
  checkTransitions,
  canMoveCheck,
  isOutstandingCheck,
  summarizeChecks,
  monthRange,
  type Movement,
} from "../lib/finance.ts";

function mv(over: Partial<Movement> = {}): Movement {
  return { direction: "in", amount: 100, method: "cash", category: "deposit", occurred_on: "2026-09-02", ...over };
}

test("çıkış hareketi eksi işaretli sayılır", () => {
  assert.equal(signedAmount({ direction: "in", amount: 100 }), 100);
  assert.equal(signedAmount({ direction: "out", amount: 100 }), -100);
});

test("eksi girilmiş tutar yön kuralını bozmaz", () => {
  assert.equal(signedAmount({ direction: "in", amount: -100 }), 100);
  assert.equal(signedAmount({ direction: "out", amount: -100 }), -100);
});

test("özet giriş, çıkış ve neti ayırır", () => {
  const s = summarize([mv({ amount: 300 }), mv({ direction: "out", amount: 120 }), mv({ amount: 50 })]);
  assert.equal(s.inflow, 350);
  assert.equal(s.outflow, 120);
  assert.equal(s.net, 230);
  assert.equal(s.count, 3);
});

test("kuruş toplamı yuvarlama artığı bırakmaz", () => {
  const s = summarize([mv({ amount: 0.1 }), mv({ amount: 0.2 })]);
  assert.equal(s.inflow, 0.3);
});

test("kategori kırılımı sadece istenen yönü toplar, büyükten küçüğe", () => {
  const rows = groupByCategory(
    [
      mv({ category: "deposit", amount: 100 }),
      mv({ category: "installment", amount: 500 }),
      mv({ direction: "out", category: "rent", amount: 900 }),
    ],
    "in"
  );
  assert.deepEqual(rows.map((r) => [r.category, r.total]), [["installment", 500], ["deposit", 100]]);
});

test("yöntem kırılımı gideri düşer — kartla iade nakdi şişirmez", () => {
  const rows = groupByMethod([
    mv({ method: "card", amount: 200 }),
    mv({ method: "card", direction: "out", amount: 50 }),
    mv({ method: "cash", amount: 30 }),
  ]);
  assert.equal(rows.find((r) => r.method === "card")?.net, 150);
  assert.equal(rows.find((r) => r.method === "cash")?.net, 30);
});

test("günlük toplamlar yeniden eskiye sıralanır", () => {
  const days = dailyTotals([
    mv({ occurred_on: "2026-09-01", amount: 100 }),
    mv({ occurred_on: "2026-09-03", amount: 40 }),
    mv({ occurred_on: "2026-09-03", direction: "out", amount: 10 }),
  ]);
  assert.deepEqual(days.map((d) => d.day), ["2026-09-03", "2026-09-01"]);
  assert.equal(days[0].net, 30);
});

// ── Çekler ────────────────────────────────────────────────────────────────────

test("çek durum geçişleri: tahsil edilen çek kapanır", () => {
  assert.deepEqual(checkTransitions("portfolio"), ["deposited", "cleared", "cancelled"]);
  assert.deepEqual(checkTransitions("deposited"), ["cleared", "bounced"]);
  assert.deepEqual(checkTransitions("cleared"), []);
  assert.equal(canMoveCheck("cleared", "bounced"), false);
});

test("karşılıksız çek yeniden bankaya verilebilir", () => {
  assert.equal(canMoveCheck("bounced", "deposited"), true);
});

test("tahsil edilmiş ve iptal edilmiş çek artık para beklemiyor", () => {
  assert.equal(isOutstandingCheck("cleared"), false);
  assert.equal(isOutstandingCheck("cancelled"), false);
  assert.equal(isOutstandingCheck("bounced"), true);
});

test("çek özeti sadece bekleyenleri sayar ve vadeye göre ayırır", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  const s = summarizeChecks(
    [
      { direction: "received", amount: 1000, due_date: "2026-09-01", status: "portfolio" }, // gecikmiş
      { direction: "received", amount: 500, due_date: "2026-09-14", status: "deposited" }, // bu hafta
      { direction: "issued", amount: 200, due_date: "2026-09-30", status: "portfolio" },
      { direction: "received", amount: 9999, due_date: "2026-09-05", status: "cleared" }, // sayılmaz
    ],
    now
  );
  assert.equal(s.incoming, 1500);
  assert.equal(s.outgoing, 200);
  assert.equal(s.overdue, 1000);
  assert.equal(s.dueThisWeek, 500);
});

test("ay aralığı şubatı doğru bitirir", () => {
  assert.deepEqual(monthRange("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(monthRange("2024-02"), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(monthRange("2026-12"), { from: "2026-12-01", to: "2026-12-31" });
});
