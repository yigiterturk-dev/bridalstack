// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Stage 20 — deneme okuma kapısı ve tanıtım verisi silme yolu             ║
// ║                                                                          ║
// ║  Kayıt YAZAR — canlı veritabanına ASLA çalıştırma. Boş bir yerelde:      ║
// ║    createdb bridalstack_migcheck && ... npx prisma migrate deploy           ║
// ║    DATABASE_URL=... DIRECT_URL=... node --experimental-strip-types \     ║
// ║      tests/e2e/stage20-trial-demo.mjs                                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { PrismaClient } from "@prisma/client";
import { startTrial, activeTrialPacks, effectivePacks, TRIAL_DAYS } from "../../lib/trial.ts";
import { buildDemoData } from "../../lib/demo-data.ts";

const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log("  ✓", n)) : (fail++, console.log("  ✖", n)); };

const u = await prisma.user.create({ data: { email: `trial${Date.now()}@x.io`, password_hash: "x" } });
const t = await prisma.tenant.create({
  data: { name: "T", slug: `trial${Date.now()}`, owner_id: u.id, packs: ["base", "salon"] },
});

// ── Deneme yazımı ─────────────────────────────────────────────────────────
const grant = startTrial(["sales"], new Date());
await prisma.tenant.updateMany({
  where: { id: t.id, trial_started_at: null },
  data: { settings: { trial_packs: grant.trialPacks }, trial_started_at: grant.trialStartedAt, trial_ends_at: grant.trialEndsAt },
});
const fresh = await prisma.tenant.findUnique({ where: { id: t.id } });
ok("deneme paketleri kiracının packs alanına yazılmaz", !fresh.packs.includes("sales"));
ok("deneme okuma anında açılır", activeTrialPacks(fresh.settings, fresh.trial_ends_at, new Date()).includes("sales"));
ok("effectivePacks ikisini birleştirir", effectivePacks(fresh.packs, fresh.settings, fresh.trial_ends_at, new Date()).length === 3);

const later = new Date(Date.now() + (TRIAL_DAYS + 1) * 86400000);
ok("deneme süresi bitince kendiliğinden kapanır", activeTrialPacks(fresh.settings, fresh.trial_ends_at, later).length === 0);

const second = await prisma.tenant.updateMany({ where: { id: t.id, trial_started_at: null }, data: { trial_ends_at: later } });
ok("ikinci kez başlatma yarış kapısına takılır", second.count === 0);

// ── Tanıtım verisi ────────────────────────────────────────────────────────
const data = buildDemoData(new Date());
const cids = new Map();
for (const c of data.customers) {
  const row = await prisma.customer.create({ data: { tenant_id: t.id, ...c, metadata: { ...c.metadata } }, select: { id: true } });
  cids.set(c.name, row.id);
}
for (const p of data.products) {
  const { sku, ...rest } = p;
  await prisma.product.create({ data: { tenant_id: t.id, sku, ...rest, metadata: { ...p.metadata } } });
}
for (const o of data.orders) {
  const { customerName, ...fields } = o;
  const lines = data.orderLines.filter((l) => l.orderRef === o.ref_no);
  await prisma.order.create({
    data: {
      tenant_id: t.id, customer_id: cids.get(customerName), ...fields, metadata: { ...o.metadata },
      lines: { create: lines.map((l, i) => ({ description: l.name, kind: l.kind, quantity: l.quantity, unit_price: l.unit_price, position: i })) },
    },
  });
}
for (const a of data.appointments) {
  const { customerName, ...fields } = a;
  await prisma.appointment.create({ data: { tenant_id: t.id, customer_id: cids.get(customerName), ...fields } });
}

// Kullanıcının kendi kaydı — silinmemeli.
const mine = await prisma.customer.create({ data: { tenant_id: t.id, name: "Real Bride" } });
await prisma.order.create({ data: { tenant_id: t.id, customer_id: mine.id, ref_no: "REAL-1", discounted_total: 100 } });

const DEMO = { path: ["demo"], equals: true };
ok("demo müşterileri işaretten bulunur", (await prisma.customer.count({ where: { tenant_id: t.id, metadata: DEMO } })) === data.customers.length);

// Silme yolu
const demoCustomers = await prisma.customer.findMany({ where: { tenant_id: t.id, metadata: DEMO }, select: { id: true } });
const ids = demoCustomers.map((c) => c.id);
const stray = await prisma.order.count({ where: { tenant_id: t.id, customer_id: { in: ids }, NOT: { metadata: DEMO } } });
ok("demo müşterisinde kullanıcı siparişi yok", stray === 0);
await prisma.order.deleteMany({ where: { tenant_id: t.id, metadata: DEMO } });
await prisma.appointment.deleteMany({ where: { tenant_id: t.id, customer_id: { in: ids } } });
await prisma.customer.deleteMany({ where: { tenant_id: t.id, metadata: DEMO } });
await prisma.product.deleteMany({ where: { tenant_id: t.id, metadata: DEMO } });

ok("demo kayıtları silindi", (await prisma.customer.count({ where: { tenant_id: t.id, metadata: DEMO } })) === 0
  && (await prisma.product.count({ where: { tenant_id: t.id, metadata: DEMO } })) === 0
  && (await prisma.order.count({ where: { tenant_id: t.id, metadata: DEMO } })) === 0);
ok("sipariş kalemleri siparişle birlikte düştü", (await prisma.orderLine.count({ where: { order: { tenant_id: t.id } } })) === 0);
ok("kullanıcının kendi müşterisi ve siparişi duruyor",
  (await prisma.customer.count({ where: { tenant_id: t.id } })) === 1
  && (await prisma.order.count({ where: { tenant_id: t.id } })) === 1);

console.log(`\n  ${pass} geçti, ${fail} kaldı`);
await prisma.$disconnect();
process.exit(fail > 0 ? 1 : 0);
