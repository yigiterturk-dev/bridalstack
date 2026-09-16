import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemoData, buildDemoOperations } from "../lib/demo-data.ts";
import { isDemoTenant, DEMO_TENANT_SLUG } from "../lib/demo-identity.ts";
import { hasPermission } from "../lib/rbac.ts";

const now = new Date("2026-09-17T12:00:00Z");
const data = buildDemoData(now);
const ops = buildDemoOperations(now);

test("tanıtım işlemleri var olan müşteri ve ürünlere bağlanır", () => {
  const names = new Set(data.customers.map((c) => c.name));
  const skus = new Set(data.products.map((p) => p.sku));
  const refs = new Set(data.orders.map((o) => o.ref_no));

  for (const r of ops.rentals) {
    assert.ok(names.has(r.customerName), `kiralamanın müşterisi yok: ${r.customerName}`);
    assert.ok(skus.has(r.productSku), `kiralamanın ürünü yok: ${r.productSku}`);
  }
  for (const a of ops.alterations) {
    assert.ok(names.has(a.customerName), `tadilatın müşterisi yok: ${a.customerName}`);
    assert.ok(skus.has(a.productSku), `tadilatın ürünü yok: ${a.productSku}`);
    if (a.orderRef) assert.ok(refs.has(a.orderRef), `tadilatın siparişi yok: ${a.orderRef}`);
  }
  for (const j of ops.cleaning) {
    assert.ok(skus.has(j.productSku), `temizlemenin ürünü yok: ${j.productSku}`);
  }
});

test("temizleme işi yalnızca dönmüş bir kiralamadan doğar", () => {
  const rentalsByKey = new Map(ops.rentals.map((r) => [r.key, r]));
  for (const j of ops.cleaning) {
    if (!j.fromRentalKey) continue;
    const rental = rentalsByKey.get(j.fromRentalKey);
    assert.ok(rental, `temizleme kaynağı bulunamadı: ${j.fromRentalKey}`);
    assert.equal(rental!.status, "returned", "dönmemiş elbise temizlemeye gidemez");
    assert.ok(rental!.returned_on, "dönüş tarihi olmadan temizleme işi olmaz");
  }
});

test("aynı kiralama iki temizleme işi doğurmaz — şemadaki tekil anahtar", () => {
  const keys = ops.cleaning.map((j) => j.fromRentalKey).filter(Boolean);
  assert.equal(new Set(keys).size, keys.length);
});

test("çıkmış kiralamada teslim tarihi var, dönüş tarihi yok", () => {
  for (const r of ops.rentals) {
    if (r.status === "out") {
      assert.ok(r.picked_up_on, "çıkan elbisenin teslim tarihi olmalı");
      assert.equal(r.returned_on, null, "çıkan elbise dönmüş görünemez");
    }
    assert.ok(r.due_date >= r.start_date, "dönüş günü başlangıçtan önce olamaz");
  }
});

test("teminat gelir değil — kira bedelinden ayrı durur", () => {
  for (const r of ops.rentals) {
    assert.ok(r.deposit > 0);
    assert.ok(r.rental_fee > 0);
  }
});

test("tanıtım kiracısı yalnız kendi slug'ıyla tanınır", () => {
  assert.equal(isDemoTenant({ slug: DEMO_TENANT_SLUG }), true);
  assert.equal(isDemoTenant({ slug: "marchesa-bridal" }), false);
  assert.equal(isDemoTenant(null), false);
  assert.equal(isDemoTenant(undefined), false);
  assert.equal(isDemoTenant({ slug: null }), false);
});

test("ziyaretçinin rolü hiçbir yazma iznine sahip değil", () => {
  const writes = [
    "customers.manage",
    "orders.manage",
    "products.manage",
    "appointments.manage",
    "staff.manage",
    "billing.manage",
    "settings.manage",
    "import.run",
  ] as const;
  for (const p of writes) {
    assert.equal(hasPermission("viewer", p), false, `viewer ${p} iznine sahip olmamalı`);
  }
  // Okuma tarafı açık kalmalı, yoksa demo boş ekran gösterir.
  assert.equal(hasPermission("viewer", "customers.view"), true);
  assert.equal(hasPermission("viewer", "orders.view"), true);
});
