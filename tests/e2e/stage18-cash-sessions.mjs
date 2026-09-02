// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Stage 18 — kasa oturumu: dondurma, fark ve tekil kayıt                  ║
// ║                                                                          ║
// ║  Kayıt YAZAR — canlı veritabanına ASLA çalıştırma. Boş bir yerelde:      ║
// ║    createdb stackcrm_migcheck                                            ║
// ║    DATABASE_URL="postgresql://$USER@localhost:5432/stackcrm_migcheck" \  ║
// ║    DIRECT_URL="$DATABASE_URL" npx prisma migrate deploy                  ║
// ║    DATABASE_URL=... DIRECT_URL=... node --experimental-strip-types \     ║
// ║      tests/e2e/stage18-cash-sessions.mjs                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { PrismaClient } from "@prisma/client";
import {
  DRAWER_METHOD, carryOver, expectedClose, expectedFor, variance, varianceMovement,
} from "../../lib/cash-session.ts";

const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log("  ✓", n)) : (fail++, console.log("  ✖", n)); };

const u = await prisma.user.create({ data: { email: `cs${Date.now()}@x.io`, password_hash: "x" } });
const t = await prisma.tenant.create({ data: { name: "T", slug: `cs${Date.now()}`, owner_id: u.id } });

const DAY = "2026-09-02";
const drawer = (d) => prisma.cashMovement.findMany({ where: { tenant_id: t.id, occurred_on: d, method: DRAWER_METHOD }, select: { direction: true, amount: true, method: true } });

// Gün: 300 açılış + 500 nakit + 3000 kart − 120 nakit gider
await prisma.cashMovement.createMany({
  data: [
    { tenant_id: t.id, direction: "in", amount: 500, method: "cash", category: "deposit", occurred_on: DAY },
    { tenant_id: t.id, direction: "in", amount: 3000, method: "card", category: "balance", occurred_on: DAY },
    { tenant_id: t.id, direction: "out", amount: 120, method: "cash", category: "other", occurred_on: DAY },
  ],
});

const s = await prisma.cashSession.create({ data: { tenant_id: t.id, business_date: DAY, opening_float: 300 } });

let movements = await drawer(DAY);
ok("kartla geçen 3000 çekmeceye girmedi (300 + 500 − 120 = 680)", expectedClose(300, movements) === 680);

// ── Aynı gün ikinci oturum açılamaz
let dup = false;
try { await prisma.cashSession.create({ data: { tenant_id: t.id, business_date: DAY, opening_float: 0 } }); } catch { dup = true; }
ok("aynı gün için ikinci oturum açılamaz", dup);

// ── Kapanış: sayılan 700, beklenen 680 → 20 fazla, dondurulur
const expected = expectedClose(300, movements);
const counted = 700;
const diff = Math.round((counted - expected) * 100) / 100;
const post = varianceMovement(diff);
await prisma.$transaction(async (tx) => {
  await tx.cashSession.updateMany({ where: { id: s.id, tenant_id: t.id, status: "open" }, data: { status: "closed", counted_close: counted, expected_close: expected, closed_at: new Date() } });
  await tx.cashMovement.create({ data: { tenant_id: t.id, direction: post.direction, amount: post.amount, method: DRAWER_METHOD, category: "other", occurred_on: DAY, description: "Till count", cash_session_id: s.id } });
});

let closed = await prisma.cashSession.findUnique({ where: { id: s.id } });
ok("beklenen tutar kapanışta donduruldu (680)", closed.expected_close === 680);
ok("fark 20 fazla olarak hesaplandı", variance(closed, await drawer(DAY)) === 20);
ok("fazla para gelir olarak yazıldı", (await prisma.cashMovement.findFirst({ where: { cash_session_id: s.id } })).direction === "in");

// ── Geriye dönük hareket geçmiş sayımı DEĞİŞTİRMEZ
await prisma.cashMovement.create({ data: { tenant_id: t.id, direction: "in", amount: 5000, method: "cash", category: "other", occurred_on: DAY } });
movements = await drawer(DAY);
ok("o güne 5000 nakit eklendi ama dondurulmuş beklenti değişmedi", expectedFor(closed, movements) === 680);
ok("geçmiş sayımın farkı da değişmedi", variance(closed, movements) === 20);

// ── Aynı oturumun farkı iki kez yazılamaz
let blocked = false;
try { await prisma.cashMovement.create({ data: { tenant_id: t.id, direction: "in", amount: 20, method: "cash", category: "other", occurred_on: DAY, cash_session_id: s.id } }); } catch { blocked = true; }
ok("aynı oturumun farkı iki kez kasaya yazılamaz", blocked);

// ── Kapanmış oturum yeniden kapatılamaz (koşullu güncelleme)
const again = await prisma.cashSession.updateMany({ where: { id: s.id, tenant_id: t.id, status: "open" }, data: { counted_close: 9999 } });
ok("kapanmış oturum yeniden kapatılamadı", again.count === 0);
closed = await prisma.cashSession.findUnique({ where: { id: s.id } });
ok("sayılan tutar bozulmadı", closed.counted_close === 700);

// ── Ertesi gün dünkü sayımla açılır
const prev = await prisma.cashSession.findFirst({ where: { tenant_id: t.id, business_date: { lt: "2026-09-03" } }, orderBy: { business_date: "desc" } });
ok("ertesi gün 700 devrediyor", carryOver(prev) === 700);

// ── Kiracı izolasyonu
const t2 = await prisma.tenant.create({ data: { name: "T2", slug: `cs2${Date.now()}`, owner_id: u.id } });
ok("başka kiracı oturumu göremez", (await prisma.cashSession.findFirst({ where: { id: s.id, tenant_id: t2.id } })) === null);
ok("aynı gün başka kiracıda açılabilir", !!(await prisma.cashSession.create({ data: { tenant_id: t2.id, business_date: DAY, opening_float: 0 } })));

console.log(`\n${pass} geçti, ${fail} kaldı`);
await prisma.$disconnect();
process.exit(fail === 0 ? 0 : 1);
