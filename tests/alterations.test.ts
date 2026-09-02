import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedTransitions,
  canTransition,
  isOpen,
  isOverdue,
  kindLabel,
  shouldCharge,
  urgencyKey,
} from "../lib/alterations.ts";

test("tadilat durum geçişleri tek yönlüdür", () => {
  assert.deepEqual(allowedTransitions("requested"), ["in_progress", "cancelled"]);
  assert.deepEqual(allowedTransitions("in_progress"), ["ready", "cancelled"]);
  assert.deepEqual(allowedTransitions("ready"), ["delivered"]);
  assert.deepEqual(allowedTransitions("delivered"), []);
  assert.equal(canTransition("ready", "cancelled"), false);
});

test("ücret yalnız teslimde kasaya girer", () => {
  assert.equal(shouldCharge("delivered", 120), true);
  assert.equal(shouldCharge("ready", 120), false);
  assert.equal(shouldCharge("cancelled", 120), false);
  assert.equal(shouldCharge("delivered", 0), false);
});

test("teslim edilen ve iptal edilen iş listeyi meşgul etmez", () => {
  assert.equal(isOpen("requested"), true);
  assert.equal(isOpen("ready"), true);
  assert.equal(isOpen("delivered"), false);
  assert.equal(isOpen("cancelled"), false);
});

test("söz verilen gün geçmiş açık iş gecikmiştir", () => {
  assert.equal(isOverdue({ status: "in_progress", promised_date: "2026-09-01" }, "2026-09-02"), true);
  assert.equal(isOverdue({ status: "in_progress", promised_date: "2026-09-02" }, "2026-09-02"), false);
  assert.equal(isOverdue({ status: "delivered", promised_date: "2026-01-01" }, "2026-09-02"), false);
  assert.equal(isOverdue({ status: "requested", promised_date: null }, "2026-09-02"), false);
});

test("geciken iş listenin başına, tarihsiz iş sonuna", () => {
  const today = "2026-09-02";
  const rows = [
    { status: "requested", promised_date: null },
    { status: "delivered", promised_date: "2026-08-01" },
    { status: "in_progress", promised_date: "2026-09-20" },
    { status: "in_progress", promised_date: "2026-08-30" },
  ];
  const order = [...rows].sort((a, b) => urgencyKey(a, today).localeCompare(urgencyKey(b, today)));
  assert.deepEqual(
    order.map((r) => `${r.status}:${r.promised_date}`),
    ["in_progress:2026-08-30", "in_progress:2026-09-20", "requested:null", "delivered:2026-08-01"]
  );
});

test("bilinmeyen iş türü ham kimliğiyle gösterilir", () => {
  assert.equal(kindLabel("bustle"), "Bustle");
  assert.equal(kindLabel("mystery"), "mystery");
});
