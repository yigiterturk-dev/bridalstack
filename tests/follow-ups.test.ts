import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isStrongInterest,
  buildFollowUps,
  buildGownPerformance,
  type TryOnSignal,
  type OrderSignal,
} from "../lib/follow-ups.ts";

const d = (iso: string) => new Date(iso);
const NOW = d("2026-09-02T12:00:00Z");

function tryOn(over: Partial<TryOnSignal> = {}): TryOnSignal {
  return {
    customer_id: "c1",
    product_id: "p1",
    reaction: "loved",
    rating: null,
    created_at: d("2026-08-01T10:00:00Z"),
    ...over,
  };
}

test("güçlü ilgi: loved ve liked sayılır, maybe ve no sayılmaz", () => {
  assert.equal(isStrongInterest({ reaction: "loved", rating: null }), true);
  assert.equal(isStrongInterest({ reaction: "liked", rating: null }), true);
  assert.equal(isStrongInterest({ reaction: "maybe", rating: null }), false);
  assert.equal(isStrongInterest({ reaction: "no", rating: null }), false);
});

test("tepki yazılmamışsa yüksek puan güçlü ilgi sayılır", () => {
  assert.equal(isStrongInterest({ reaction: null, rating: 4 }), true);
  assert.equal(isStrongInterest({ reaction: null, rating: 5 }), true);
  assert.equal(isStrongInterest({ reaction: null, rating: 3 }), false);
  assert.equal(isStrongInterest({ reaction: null, rating: null }), false);
});

test("bayıldı ama sipariş vermedi -> takip listesinde", () => {
  const result = buildFollowUps([tryOn()], [], NOW);
  assert.equal(result.length, 1);
  assert.equal(result[0].customer_id, "c1");
  assert.equal(result[0].bestReaction, "loved");
  assert.equal(result[0].daysSince, 32);
});

test("provadan sonra sipariş verdiyse listeden düşer", () => {
  const orders: OrderSignal[] = [{ customer_id: "c1", created_at: d("2026-08-05T10:00:00Z") }];
  assert.equal(buildFollowUps([tryOn()], orders, NOW).length, 0);
});

test("provadan ÖNCEKİ sipariş takibi düşürmez", () => {
  // Eski bir sipariş, yeni provanın takip edilmediği gerçeğini değiştirmez.
  const orders: OrderSignal[] = [{ customer_id: "c1", created_at: d("2026-07-01T10:00:00Z") }];
  const result = buildFollowUps([tryOn()], orders, NOW);
  assert.equal(result.length, 1);
});

test("beğenmediği provalar takip üretmez", () => {
  assert.equal(buildFollowUps([tryOn({ reaction: "no" })], [], NOW).length, 0);
  assert.equal(buildFollowUps([tryOn({ reaction: "maybe" })], [], NOW).length, 0);
});

test("aynı gelinin birden çok sinyali tek satırda toplanır", () => {
  const result = buildFollowUps(
    [
      tryOn({ product_id: "p1", reaction: "liked", created_at: d("2026-08-01T10:00:00Z") }),
      tryOn({ product_id: "p2", reaction: "loved", created_at: d("2026-08-20T10:00:00Z") }),
    ],
    [],
    NOW
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].signalCount, 2);
  // En güçlü sinyalin ürünü öne çıkar.
  assert.equal(result[0].topProductId, "p2");
  assert.equal(result[0].bestReaction, "loved");
});

test("sıralama: loved olan liked olandan önce gelir", () => {
  const result = buildFollowUps(
    [
      tryOn({ customer_id: "c1", reaction: "liked" }),
      tryOn({ customer_id: "c2", reaction: "loved" }),
    ],
    [],
    NOW
  );
  assert.deepEqual(result.map((r) => r.customer_id), ["c2", "c1"]);
});

test("eşit güçte sinyalde en uzun bekleyen öne alınır", () => {
  const result = buildFollowUps(
    [
      tryOn({ customer_id: "yeni", created_at: d("2026-09-01T10:00:00Z") }),
      tryOn({ customer_id: "eski", created_at: d("2026-06-01T10:00:00Z") }),
    ],
    [],
    NOW
  );
  assert.deepEqual(result.map((r) => r.customer_id), ["eski", "yeni"]);
});

test("elbise performansı: kaçırılan ilgi sayılır", () => {
  const tryOns = [
    tryOn({ customer_id: "c1", product_id: "p1", reaction: "loved" }),
    tryOn({ customer_id: "c2", product_id: "p1", reaction: "loved" }),
    tryOn({ customer_id: "c3", product_id: "p1", reaction: "no" }),
  ];
  const orders: OrderSignal[] = [{ customer_id: "c2", created_at: d("2026-08-10T10:00:00Z") }];

  const [stat] = buildGownPerformance(tryOns, orders);
  assert.equal(stat.product_id, "p1");
  assert.equal(stat.tryOnCount, 3);
  assert.equal(stat.lovedCount, 2);
  assert.equal(stat.missedCount, 1);
  assert.equal(stat.conversionRate, 50);
});

test("hiç güçlü ilgi yoksa dönüşüm oranı null", () => {
  const [stat] = buildGownPerformance([tryOn({ reaction: "no" })], []);
  assert.equal(stat.conversionRate, null);
});

test("elbise performansı en çok kaçırılana göre sıralanır", () => {
  const tryOns = [
    tryOn({ customer_id: "a", product_id: "az" }),
    tryOn({ customer_id: "b", product_id: "cok" }),
    tryOn({ customer_id: "c", product_id: "cok" }),
  ];
  const result = buildGownPerformance(tryOns, []);
  assert.deepEqual(result.map((r) => r.product_id), ["cok", "az"]);
});
