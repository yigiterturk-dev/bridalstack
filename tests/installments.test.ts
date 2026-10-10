import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInstallmentPlan, deriveStatus, reminderFor, daysUntilDue } from "../lib/installments.ts";

test("buildInstallmentPlan: 3 eşit taksit, toplam korunur (happy path)", () => {
  const plan = buildInstallmentPlan(300, 3, "2026-01-15");
  assert.equal(plan.length, 3);
  assert.deepEqual(plan.map((p) => p.amount), [100, 100, 100]);
  assert.deepEqual(plan.map((p) => p.due_date), ["2026-01-15", "2026-02-15", "2026-03-15"]);
  assert.equal(plan.map((p) => p.amount).reduce((a, b) => a + b, 0), 300);
});

test("buildInstallmentPlan: yuvarlama farkı ilk taksite eklenir, toplam korunur (edge)", () => {
  // 100 / 3 = 33.333... -> kuruş bazında 3334 + 3333 + 3333 = 10000
  const plan = buildInstallmentPlan(100, 3, "2026-01-31");
  const amounts = plan.map((p) => p.amount);
  assert.deepEqual(amounts, [33.34, 33.33, 33.33]);
  const totalCents = amounts.reduce((a, b) => a + Math.round(b * 100), 0);
  assert.equal(totalCents, 10000); // toplam tam 100.00, sızıntı yok
});

test("buildInstallmentPlan: count<1 en az 1 taksite zorlanır (edge/abuse)", () => {
  const plan = buildInstallmentPlan(50, 0, "2026-05-01");
  assert.equal(plan.length, 1);
  assert.equal(plan[0].amount, 50);
  assert.equal(plan[0].total_count, 1);
});

test("daysUntilDue & deriveStatus: vade durumu doğru türetilir", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  assert.equal(daysUntilDue("2026-06-13", now), 3);
  // 3 gün kala -> due (UPCOMING penceresi içinde)
  assert.equal(deriveStatus({ due_date: "2026-06-13", paid_at: null, status: "pending" }, now), "due");
  // 10 gün ileri -> pending
  assert.equal(deriveStatus({ due_date: "2026-06-20", paid_at: null, status: "pending" }, now), "pending");
  // geçmiş -> overdue
  assert.equal(deriveStatus({ due_date: "2026-06-01", paid_at: null, status: "pending" }, now), "overdue");
});

test("deriveStatus: ödenmiş/iptal sabit kalır (abuse: overdue'ya kaymaz)", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  // çok eski vade ama ödenmiş -> paid kalmalı, overdue OLMAMALI
  assert.equal(deriveStatus({ due_date: "2020-01-01", paid_at: "2020-01-02", status: "pending" }, now), "paid");
  assert.equal(deriveStatus({ due_date: "2020-01-01", paid_at: null, status: "cancelled" }, now), "cancelled");
});

test("reminderFor: bugün vade -> due_today, ödenmiş/iptal -> null", () => {
  const now = new Date("2026-06-10T08:00:00Z");
  assert.equal(reminderFor({ due_date: "2026-06-10", paid_at: null, status: "pending" }, now), "due_today");
  assert.equal(reminderFor({ due_date: "2026-06-12", paid_at: null, status: "pending" }, now), "upcoming");
  assert.equal(reminderFor({ due_date: "2026-06-01", paid_at: null, status: "pending" }, now), "overdue");
  assert.equal(reminderFor({ due_date: "2026-06-01", paid_at: "2026-05-01", status: "pending" }, now), null);
});

test("installment dates can use a tenant-local today override", () => {
  const now = new Date("2026-06-11T00:30:00Z");
  assert.equal(daysUntilDue("2026-06-10", now, "2026-06-10"), 0);
  assert.equal(reminderFor({ due_date: "2026-06-10", paid_at: null, status: "pending" }, now, "2026-06-10"), "due_today");
  assert.equal(deriveStatus({ due_date: "2026-06-10", paid_at: null, status: "pending" }, now, "2026-06-10"), "due");
});
