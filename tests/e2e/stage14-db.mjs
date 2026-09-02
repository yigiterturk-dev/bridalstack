// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Stage 14 — kiralama / temizleme / tadilat: VERİTABANI değişmezleri      ║
// ║                                                                          ║
// ║  Saf kural testleri (tests/rentals|cleaning|alterations.test.ts) mantığı ║
// ║  doğrular; bu dosya kilidin gerçekten şemada olduğunu doğrular.          ║
// ║  Kayıt YAZAR — canlı veritabanına ASLA çalıştırma. Boş bir yerelde:      ║
// ║                                                                          ║
// ║    createdb stackcrm_migcheck                                            ║
// ║    DATABASE_URL="postgresql://$USER@localhost:5432/stackcrm_migcheck" \  ║
// ║    DIRECT_URL="$DATABASE_URL" npx prisma migrate deploy                  ║
// ║    DATABASE_URL=... DIRECT_URL=... node tests/e2e/stage14-db.mjs         ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? (pass++, console.log("  ✓", name)) : (fail++, console.log("  ✖", name)); };
async function throws(name, fn) {
  try { await fn(); ok(name + " (engellenmeliydi)", false); }
  catch { ok(name, true); }
}

const u = await prisma.user.create({ data: { email: `t${Date.now()}@x.io`, password_hash: "x" } });
const t = await prisma.tenant.create({ data: { name: "T", slug: `t${Date.now()}`, owner_id: u.id } });
const c = await prisma.customer.create({ data: { tenant_id: t.id, name: "Bride" } });
const p = await prisma.product.create({ data: { tenant_id: t.id, name: "Gown", stock_quantity: 3 } });

// ── Kiralama: kira bedeli iki kez kasaya yazılamaz
const r = await prisma.rental.create({
  data: { tenant_id: t.id, customer_id: c.id, product_id: p.id, start_date: "2026-09-10", due_date: "2026-09-14", rental_fee: 200, late_fee_per_day: 20 },
});
await prisma.cashMovement.create({ data: { tenant_id: t.id, direction: "in", amount: 200, category: "rental", occurred_on: "2026-09-10", rental_id: r.id } });
await throws("aynı kiralama iki kez kasaya yazılamaz", () =>
  prisma.cashMovement.create({ data: { tenant_id: t.id, direction: "in", amount: 200, category: "rental", occurred_on: "2026-09-11", rental_id: r.id } }));

// ── Temizleme: aynı kiralama iki temizleme işi doğuramaz
await prisma.cleaningJob.create({ data: { tenant_id: t.id, product_id: p.id, source: "rental", rental_id: r.id } });
await throws("aynı kiralama iki temizleme işi doğuramaz", () =>
  prisma.cleaningJob.create({ data: { tenant_id: t.id, product_id: p.id, source: "rental", rental_id: r.id } }));

// ── İade: aynı iade iki temizleme işi doğuramaz
const ret = await prisma.productReturn.create({ data: { tenant_id: t.id, product_id: p.id, condition: "needs_cleaning" } });
await prisma.cleaningJob.create({ data: { tenant_id: t.id, product_id: p.id, source: "return", return_id: ret.id } });
await throws("aynı iade iki temizleme işi doğuramaz", () =>
  prisma.cleaningJob.create({ data: { tenant_id: t.id, product_id: p.id, source: "return", return_id: ret.id } }));

// ── Tadilat: ücret iki kez kasaya yazılamaz
const a = await prisma.alteration.create({ data: { tenant_id: t.id, customer_id: c.id, kind: "hem", price: 150 } });
await prisma.cashMovement.create({ data: { tenant_id: t.id, direction: "in", amount: 150, category: "alteration", occurred_on: "2026-09-12", alteration_id: a.id } });
await throws("aynı tadilat iki kez kasaya yazılamaz", () =>
  prisma.cashMovement.create({ data: { tenant_id: t.id, direction: "in", amount: 150, category: "alteration", occurred_on: "2026-09-13", alteration_id: a.id } }));

// ── Temizleme gideri iki kez yazılamaz
const cj = await prisma.cleaningJob.create({ data: { tenant_id: t.id, product_id: p.id, source: "stock", cost: 40 } });
await prisma.cashMovement.create({ data: { tenant_id: t.id, direction: "out", amount: 40, category: "cleaning", occurred_on: "2026-09-12", cleaning_job_id: cj.id } });
await throws("aynı temizleme gideri iki kez yazılamaz", () =>
  prisma.cashMovement.create({ data: { tenant_id: t.id, direction: "out", amount: 40, category: "cleaning", occurred_on: "2026-09-13", cleaning_job_id: cj.id } }));

// ── Koşullu stok düşümü eksiye kaymaz
await prisma.product.update({ where: { id: p.id }, data: { stock_quantity: 1 } });
const blocked = await prisma.product.updateMany({
  where: { id: p.id, tenant_id: t.id, stock_quantity: { gte: 2 } },
  data: { stock_quantity: { increment: -2 } },
});
ok("stokta yokken düşüm yazılmaz", blocked.count === 0);
const after = await prisma.product.findUnique({ where: { id: p.id }, select: { stock_quantity: true } });
ok("stok eksiye kaymadı", after.stock_quantity === 1);

// ── Kiracı izolasyonu: başka kiracının kaydı bulunmaz
const t2 = await prisma.tenant.create({ data: { name: "T2", slug: `t2${Date.now()}`, owner_id: u.id } });
ok("başka kiracı kiralamayı göremez", (await prisma.rental.findFirst({ where: { id: r.id, tenant_id: t2.id } })) === null);
ok("başka kiracı tadilatı göremez", (await prisma.alteration.findFirst({ where: { id: a.id, tenant_id: t2.id } })) === null);
ok("başka kiracı temizleme işini göremez", (await prisma.cleaningJob.findFirst({ where: { id: cj.id, tenant_id: t2.id } })) === null);

console.log(`\n${pass} geçti, ${fail} kaldı`);
await prisma.$disconnect();
process.exit(fail === 0 ? 0 : 1);
