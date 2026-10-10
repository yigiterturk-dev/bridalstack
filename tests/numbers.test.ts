import { test } from "node:test";
import assert from "node:assert/strict";
import { nonNegativeFloat } from "../lib/numbers.ts";

test("nonNegativeFloat: valid decimals survive and negatives clamp", () => {
  assert.equal(nonNegativeFloat("12.50"), 12.5);
  assert.equal(nonNegativeFloat("-4"), 0);
});

test("nonNegativeFloat: NaN and Infinity fall back safely", () => {
  assert.equal(nonNegativeFloat("not-a-number"), 0);
  assert.equal(nonNegativeFloat("Infinity"), 0);
  assert.equal(nonNegativeFloat("Infinity", 7), 7);
});
