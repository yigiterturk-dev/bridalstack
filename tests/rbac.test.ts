import { test } from "node:test";
import assert from "node:assert/strict";
import { roleAtLeast, hasPermission, normalizeRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from "../lib/rbac.ts";

test("roleAtLeast: owner, admin eşiğini geçer (happy path)", () => {
  assert.equal(roleAtLeast("owner", "admin"), true);
  assert.equal(roleAtLeast("admin", "admin"), true);
  assert.equal(roleAtLeast("owner", "viewer"), true);
});

test("roleAtLeast: yetki yükseltme reddi — düşük rol yüksek eşiği geçemez", () => {
  // viewer admin olamaz, stylist owner olamaz: privilege escalation engeli
  assert.equal(roleAtLeast("viewer", "admin"), false);
  assert.equal(roleAtLeast("stylist", "owner"), false);
  assert.equal(roleAtLeast("stylist", "admin"), false);
});

test("roleAtLeast: bilinmeyen/null rol en düşük (viewer) gibi davranır — fail-closed", () => {
  assert.equal(roleAtLeast(null, "viewer"), true);
  assert.equal(roleAtLeast(undefined, "stylist"), false);
  assert.equal(roleAtLeast("superhacker", "admin"), false);
});

test("hasPermission: admin billing.manage YETKİSİNE sahip değil (escalation denied)", () => {
  assert.equal(hasPermission("owner", "billing.manage"), true);
  assert.equal(hasPermission("admin", "billing.manage"), false);
  assert.equal(hasPermission("viewer", "customers.manage"), false);
});

test("normalizeRole: eski 'member' -> 'stylist', geçersiz -> 'viewer'", () => {
  assert.equal(normalizeRole("member"), "stylist");
  assert.equal(normalizeRole("garbage"), "viewer");
  assert.equal(normalizeRole(null), "viewer");
});

test("staff role labels and descriptions are customer-facing English", () => {
  assert.deepEqual(ROLE_LABELS, {
    owner: "Owner",
    admin: "Administrator",
    stylist: "Stylist",
    viewer: "Viewer",
  });
  assert.deepEqual(ROLE_DESCRIPTIONS, {
    owner: "Full access + billing",
    admin: "Full access except billing",
    stylist: "Manage customers, appointments, and orders",
    viewer: "Read-only access",
  });
});
