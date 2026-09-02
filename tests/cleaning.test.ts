import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedTransitions,
  canTransition,
  intakeStockDelta,
  isOverdue,
  outcomeStockDelta,
  shouldPostCost,
} from "../lib/cleaning.ts";

test("raftan çıkan mal düşer, iade/kiradan gelen düşmez", () => {
  assert.equal(intakeStockDelta("stock", 2), -2);
  assert.equal(intakeStockDelta("return", 2), 0);
  assert.equal(intakeStockDelta("rental", 1), 0);
});

test("mal rafa yalnız dönüşte girer, hurdada girmez", () => {
  assert.equal(outcomeStockDelta("returned", 2), 2);
  assert.equal(outcomeStockDelta("written_off", 2), 0);
  assert.equal(outcomeStockDelta("sent", 2), 0);
});

test("her yolda net stok etkisi sıfırdır", () => {
  for (const source of ["stock", "return", "rental"]) {
    const inUnits = intakeStockDelta(source, 1);
    const outUnits = outcomeStockDelta("returned", 1);
    // Raftan çıkan geri döner (0); dışarıdan gelen rafa bir kez girer (+1).
    assert.equal(inUnits + outUnits, source === "stock" ? 0 : 1);
  }
});

test("temizleme durum geçişleri tek yönlüdür", () => {
  assert.deepEqual(allowedTransitions("pending"), ["sent", "written_off"]);
  assert.deepEqual(allowedTransitions("sent"), ["returned", "written_off"]);
  assert.deepEqual(allowedTransitions("returned"), []);
  assert.equal(canTransition("returned", "sent"), false);
});

test("gider yalnız iş kapanınca ve tutar varsa kasaya yazılır", () => {
  assert.equal(shouldPostCost("returned", 40), true);
  assert.equal(shouldPostCost("returned", 0), false);
  assert.equal(shouldPostCost("sent", 40), false);
  assert.equal(shouldPostCost("written_off", 40), false);
});

test("yalnız temizlemedeki iş gecikebilir", () => {
  assert.equal(isOverdue({ status: "sent", expected_on: "2026-09-01" }, "2026-09-02"), true);
  assert.equal(isOverdue({ status: "sent", expected_on: "2026-09-02" }, "2026-09-02"), false);
  assert.equal(isOverdue({ status: "pending", expected_on: "2026-01-01" }, "2026-09-02"), false);
  assert.equal(isOverdue({ status: "sent", expected_on: null }, "2026-09-02"), false);
});
