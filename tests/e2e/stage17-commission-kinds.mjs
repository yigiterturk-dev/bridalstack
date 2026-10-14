// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Stage 17 — kalem bazlı prim: kuralın veriden doğru okunması             ║
// ║                                                                          ║
// ║  Kayıt YAZAR — canlı veritabanına ASLA çalıştırma. Boş bir yerelde:      ║
// ║    createdb bridalstack_migcheck                                            ║
// ║    DATABASE_URL="postgresql://$USER@localhost:5432/bridalstack_migcheck" \  ║
// ║    DIRECT_URL="$DATABASE_URL" npx prisma migrate deploy                  ║
// ║    DATABASE_URL=... DIRECT_URL=... node --experimental-strip-types \     ║
// ║      tests/e2e/stage17-commission-kinds.mjs                              ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { PrismaClient } from "@prisma/client";
import { commissionFor, commissionBreakdown, summarizeByStaff } from "../../lib/commissions.ts";

const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log("  ✓", n)) : (fail++, console.log("  ✖", n)); };

const u = await prisma.user.create({ data: { email: `ck${Date.now()}@x.io`, password_hash: "x" } });
const t = await prisma.tenant.create({ data: { name: "T", slug: `ck${Date.now()}`, owner_id: u.id } });
const c = await prisma.customer.create({ data: { tenant_id: t.id, name: "Bride" } });

// ── Mevcut kurallar varsayılanla açılır
const legacy = await prisma.commissionRule.create({
  data: { tenant_id: t.id, name: "Standard 5%", rate_percent: 5, flat_amount: 100 },
});
ok("mevcut kurallar 'order' varsayılanıyla açıldı", legacy.applies_to === "order" && legacy.line_kind === null);

const o = await prisma.order.create({
  data: { tenant_id: t.id, ref_no: `C${Date.now()}`, customer_id: c.id, sales_person: "Ayşe", status: "confirmed", discounted_total: 3500, order_date: "2026-09-02" },
});
await prisma.orderLine.createMany({
  data: [
    { order_id: o.id, description: "Gown", kind: "gown", quantity: 1, unit_price: 3000, position: 1 },
    { order_id: o.id, description: "Veil", kind: "veil", quantity: 2, unit_price: 250, position: 2 },
  ],
});

const loadRules = () => prisma.commissionRule.findMany({ where: { tenant_id: t.id } });
const loadLines = () => prisma.orderLine.findMany({ where: { order_id: o.id }, select: { kind: true, quantity: true, unit_price: true, discount: true } });
const loadOrder = () => prisma.order.findUnique({ where: { id: o.id }, select: { id: true, ref_no: true, sales_person: true, status: true, discounted_total: true, order_date: true, created_at: true } });

// ── Tür kuralı yokken kalemler hesabı değiştirmez
let [rules, lines, order] = await Promise.all([loadRules(), loadLines(), loadOrder()]);
ok("tür kuralı yokken eski hesap aynen çalışıyor (3500×%5 + 100)", commissionFor(order, rules, lines) === 275);

// ── Tür kuralı eklenince o kalem kendi kuralına geçer
await prisma.commissionRule.create({
  data: { tenant_id: t.id, name: "Gowns 8%", applies_to: "kind", line_kind: "gown", rate_percent: 8 },
});
[rules, lines, order] = await Promise.all([loadRules(), loadLines(), loadOrder()]);
// elbise 3000×%8 = 240, duvak 500×%5 = 25, sabit bonus bir kez 100 → 365
ok("elbise tür kuralına, duvak genel kurala düştü (240 + 25 + 100)", commissionFor(order, rules, lines) === 365);

const breakdown = commissionBreakdown(order, rules, lines);
ok("dökümde elbise 'Gowns 8%' kuralını gösteriyor", breakdown.find((b) => b.kind === "gown")?.rule?.name === "Gowns 8%");
ok("dökümde duvak 'Standard 5%' kuralını gösteriyor", breakdown.find((b) => b.kind === "veil")?.rule?.name === "Standard 5%");

// ── Satışçıya özel tür kuralı yalın tür kuralını yener
await prisma.commissionRule.create({
  data: { tenant_id: t.id, name: "Ayse gowns 12%", scope: "staff", staff_name: "Ayşe", applies_to: "kind", line_kind: "gown", rate_percent: 12 },
});
[rules, lines, order] = await Promise.all([loadRules(), loadLines(), loadOrder()]);
// elbise 3000×%12 = 360, duvak 25, bonus 100 → 485
ok("satışçıya özel tür kuralı kazandı (360 + 25 + 100)", commissionFor(order, rules, lines) === 485);

// ── Pasif kural devre dışı kalır
await prisma.commissionRule.updateMany({ where: { tenant_id: t.id, name: "Ayse gowns 12%" }, data: { is_active: false } });
[rules, lines, order] = await Promise.all([loadRules(), loadLines(), loadOrder()]);
ok("pasif kural devreden çıktı, tekrar 365", commissionFor(order, rules, lines) === 365);

// ── Satışçı özeti aynı rakamı veriyor
const map = new Map([[o.id, lines]]);
ok("satışçı özeti tek sipariş hesabıyla tutuyor", summarizeByStaff([order], rules, map)[0].commission === 365);

// ── İptal edilen sipariş prim doğurmaz
await prisma.order.update({ where: { id: o.id }, data: { status: "cancelled" } });
order = await loadOrder();
ok("iptal edilen sipariş kalemli kuralla da prim doğurmuyor", commissionFor(order, rules, lines) === 0);

// ── Kiracı izolasyonu
const t2 = await prisma.tenant.create({ data: { name: "T2", slug: `ck2${Date.now()}`, owner_id: u.id } });
ok("başka kiracı kuralları göremez", (await prisma.commissionRule.count({ where: { tenant_id: t2.id } })) === 0);

console.log(`\n${pass} geçti, ${fail} kaldı`);
await prisma.$disconnect();
process.exit(fail === 0 ? 0 : 1);
