import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCESS_SECTIONS,
  canSeeAnalytics,
  cleanHidden,
  isSectionOpen,
  toggleSection,
  visibleModules,
} from "../lib/member-access.ts";

test("boş liste: her bölüm açık", () => {
  for (const s of ACCESS_SECTIONS) assert.equal(isSectionOpen([], s.key), true);
});

test("Money kapatılınca finans modülü gizlenir, tekrar tıklayınca açılır", () => {
  const closed = toggleSection([], "money");
  assert.deepEqual(closed, ["finance"]);
  assert.equal(isSectionOpen(closed, "money"), false);
  assert.deepEqual(toggleSection(closed, "money"), []);
});

test("Numbers hem raporları hem analitiği kapatır", () => {
  const closed = toggleSection([], "numbers");
  assert.equal(canSeeAnalytics(closed, "stylist"), false);
  assert.deepEqual(visibleModules(["crm", "reports"], closed, "stylist"), ["crm"]);
});

test("sahip asla kısıtlanmaz", () => {
  const hidden = ["finance", "analytics"];
  assert.deepEqual(visibleModules(["crm", "finance"], hidden, "owner"), ["crm", "finance"]);
  assert.equal(canSeeAnalytics(hidden, "owner"), true);
});

test("bilinmeyen ve tekrar eden değerler atılır", () => {
  assert.deepEqual(cleanHidden(["finance", "finance", "x", 3, null]), ["finance"]);
  assert.deepEqual(cleanHidden(null), []);
});

test("yarım kapalı bölüm (biri gizli) kapalı sayılır, tıklayınca tamamen açılır", () => {
  assert.equal(isSectionOpen(["invoices"], "sales"), false);
  assert.deepEqual(toggleSection(["invoices"], "sales"), []);
});
