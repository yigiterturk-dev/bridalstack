import test from "node:test";
import assert from "node:assert/strict";
import { usDay } from "../lib/us-date.ts";

test("usDay: ISO gün -> US biçimi", () => {
  assert.equal(usDay("2026-11-10"), "Nov 10, 2026");
  assert.equal(usDay("2026-01-05"), "Jan 5, 2026");
  assert.equal(usDay("2026-12-31T23:59:00Z"), "Dec 31, 2026");
});
test("usDay: boş ve bozuk girdi patlamaz", () => {
  assert.equal(usDay(null), "");
  assert.equal(usDay(undefined), "");
  assert.equal(usDay("soon"), "soon");
  assert.equal(usDay("2026-13-01"), "2026-13-01");
});
