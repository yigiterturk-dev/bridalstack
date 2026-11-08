import assert from "node:assert/strict";
import test from "node:test";
import { chooseTenantId } from "../lib/tenant-select.ts";

const memberships = [
  { tenantId: "a", createdAt: "2026-01-01" },
  { tenantId: "b", createdAt: "2026-02-01" },
];

test("üyelik yoksa aktif kiracı yok", () => {
  assert.equal(chooseTenantId([], "a"), null);
});

test("geçerli çerezdeki kiracı seçilir", () => {
  assert.equal(chooseTenantId(memberships, "b"), "b");
});

test("üye olunmayan kiracı çerezde olsa bile seçilmez (ilk üyeliğe düşer)", () => {
  assert.equal(chooseTenantId(memberships, "c"), "a");
  assert.equal(chooseTenantId(memberships, null), "a");
});

test("çerez boşsa ilk üyelik varsayılandır", () => {
  assert.equal(chooseTenantId(memberships, ""), "a");
});
