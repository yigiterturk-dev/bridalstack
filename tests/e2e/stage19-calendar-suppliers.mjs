// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Stage 19 — takvim kiralama sorgusu ve tedarikçi açık siparişleri        ║
// ║                                                                          ║
// ║  Kayıt YAZAR — canlı veritabanına ASLA çalıştırma. Boş bir yerelde:      ║
// ║    createdb stackcrm_migcheck && ... npx prisma migrate deploy           ║
// ║    DATABASE_URL=... DIRECT_URL=... node --experimental-strip-types \     ║
// ║      tests/e2e/stage19-calendar-suppliers.mjs                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { PrismaClient } from "@prisma/client";
import { rentalDaysInMonth } from "../../lib/calendar-events.ts";
import { isLate, summarize } from "../../lib/purchasing.ts";

const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log("  ✓", n)) : (fail++, console.log("  ✖", n)); };

const u = await prisma.user.create({ data: { email: `cal${Date.now()}@x.io`, password_hash: "x" } });
const t = await prisma.tenant.create({ data: { name: "T", slug: `cal${Date.now()}`, owner_id: u.id } });
const c = await prisma.customer.create({ data: { tenant_id: t.id, name: "Bride" } });
const p = await prisma.product.create({ data: { tenant_id: t.id, name: "Gown", stock_quantity: 5, cost: 200 } });

const mk = (start, due, status) => prisma.rental.create({ data: { tenant_id: t.id, customer_id: c.id, product_id: p.id, start_date: start, due_date: due, status } });
const inside = await mk("2026-09-10", "2026-09-13", "reserved");
const spanning = await mk("2026-08-28", "2026-09-03", "out");
const before = await mk("2026-08-01", "2026-08-05", "reserved");
const after = await mk("2026-10-10", "2026-10-12", "reserved");
const returned = await mk("2026-09-15", "2026-09-18", "returned");

// Sayfadaki sorgunun aynısı: aya DEĞEN her açık kiralama
const MONTH_START = "2026-09-01", MONTH_END = "2026-09-30";
const found = await prisma.rental.findMany({
  where: { tenant_id: t.id, status: { in: ["reserved", "out"] }, start_date: { lte: MONTH_END }, due_date: { gte: MONTH_START } },
  select: { id: true, start_date: true, due_date: true, status: true },
});
const ids = found.map((r) => r.id);

ok("ay içindeki kiralama bulundu", ids.includes(inside.id));
ok("aya sarkan kiralama da bulundu", ids.includes(spanning.id));
ok("aydan önce biten kiralama alınmadı", !ids.includes(before.id));
ok("aydan sonra başlayan kiralama alınmadı", !ids.includes(after.id));
ok("dönmüş kiralama takvime hiç girmedi", !ids.includes(returned.id));

const days = (id) => rentalDaysInMonth(found.find((r) => r.id === id), 2026, 9);
ok("ay içindeki kiralama 4 gün kaplıyor, ilki çıkış", days(inside.id).length === 4 && days(inside.id)[0].role === "pickup");
ok("sarkan kiralamanın eylüldeki son günü dönüş", days(spanning.id).at(-1).role === "due");
ok("sarkan kiralamanın eylüldeki ilk günü çıkış değil", days(spanning.id)[0].role === "out");

// ── Tedarikçi açık siparişleri
const sup = await prisma.supplier.create({ data: { tenant_id: t.id, name: "Atelier", lead_time_days: 30 } });
const draft = await prisma.purchaseOrder.create({ data: { tenant_id: t.id, supplier_id: sup.id, ref_no: `D${Date.now()}`, status: "draft" } });
const open1 = await prisma.purchaseOrder.create({ data: { tenant_id: t.id, supplier_id: sup.id, ref_no: `O${Date.now()}`, status: "partial", expected_on: "2026-08-01" } });
const done = await prisma.purchaseOrder.create({ data: { tenant_id: t.id, supplier_id: sup.id, ref_no: `R${Date.now()}`, status: "received" } });
await prisma.purchaseOrderLine.create({ data: { po_id: draft.id, product_id: p.id, ordered_qty: 9, unit_cost: 100 } });
await prisma.purchaseOrderLine.create({ data: { po_id: open1.id, product_id: p.id, ordered_qty: 5, received_qty: 2, unit_cost: 200 } });

const openOrders = await prisma.purchaseOrder.findMany({
  where: { tenant_id: t.id, status: { in: ["ordered", "partial"] } },
  select: { id: true, status: true, expected_on: true, lines: true },
});
ok("taslak sipariş 'yolda' sayılmıyor", !openOrders.some((o) => o.id === draft.id));
ok("kapanmış sipariş 'yolda' sayılmıyor", !openOrders.some((o) => o.id === done.id));
ok("açık sipariş listede", openOrders.some((o) => o.id === open1.id));

const row = openOrders.find((o) => o.id === open1.id);
const tot = summarize(row.lines);
ok("yolda kalan adet 3 (5 sipariş − 2 teslim)", tot.outstandingUnits === 3);
ok("yolda kalan para 600 (3 × 200)", tot.orderedCost - tot.receivedCost === 600);
ok("beklenen tarihi geçmiş sipariş geç işaretlendi", isLate(row, row.lines, "2026-09-02") === true);

console.log(`\n${pass} geçti, ${fail} kaldı`);
await prisma.$disconnect();
process.exit(fail === 0 ? 0 : 1);
