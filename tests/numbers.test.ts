import { test } from "node:test";
import assert from "node:assert/strict";
import { boundedInt, finiteFloat, nonNegativeFloat } from "../lib/numbers.ts";

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
