import { test } from "node:test";
import assert from "node:assert/strict";
import { boundedInt, finiteFloat, nonNegativeFloat, normalizedUpperPrice } from "../lib/numbers.ts";
import { dateInTimeZone, normalizeTimeZone, timeZoneLabel } from "../lib/timezone.ts";

test("nonNegativeFloat: valid decimals survive and negatives clamp", () => {
  assert.equal(nonNegativeFloat("12.50"), 12.5);
  assert.equal(nonNegativeFloat("-4"), 0);
});

test("nonNegativeFloat: NaN and Infinity fall back safely", () => {
  assert.equal(nonNegativeFloat("not-a-number"), 0);
  assert.equal(nonNegativeFloat("Infinity"), 0);
  assert.equal(nonNegativeFloat("Infinity", 7), 7);
});

test("finiteFloat: preserves sign but rejects non-finite values", () => {
  assert.equal(finiteFloat("-4.5"), -4.5);
  assert.equal(finiteFloat("Infinity"), 0);
  assert.equal(finiteFloat("Infinity", 9), 9);
});

test("boundedInt: preserves zero, clamps bounds, and uses fallback for blank input", () => {
  assert.equal(boundedInt("0", 0, 100, 1), 0);
  assert.equal(boundedInt("-4", 0, 100, 1), 0);
  assert.equal(boundedInt("999", 0, 100, 1), 100);
  assert.equal(boundedInt("", 0, 100, 1), 1);
  assert.equal(boundedInt("not-a-number", 0, 100, 1), 1);
});

test("normalizedUpperPrice: avoids inverted ranges and keeps blank optional", () => {
  assert.equal(normalizedUpperPrice("80", 100), 100);
  assert.equal(normalizedUpperPrice("125.50", 100), 125.5);
  assert.equal(normalizedUpperPrice("", 100), null);
  assert.equal(normalizedUpperPrice("not-a-number", 100), 100);
});

test("dateInTimeZone: uses the shop's local calendar date", () => {
  const instant = new Date("2026-10-10T01:30:00.000Z");
  assert.equal(dateInTimeZone(instant, "America/Los_Angeles"), "2026-10-09");
  assert.equal(dateInTimeZone(instant, "Europe/Istanbul"), "2026-10-10");
});

test("normalizeTimeZone: rejects invalid values safely", () => {
  assert.equal(normalizeTimeZone("America/New_York"), "America/New_York");
  assert.equal(normalizeTimeZone("not/a-timezone"), "UTC");
  assert.equal(timeZoneLabel("America/Los_Angeles"), "Pacific Time (US & Canada)");
});
