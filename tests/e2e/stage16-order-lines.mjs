// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Stage 16 — sipariş kalemleri: toplamların kalemlerden türemesi          ║
// ║                                                                          ║
// ║  Kayıt YAZAR — canlı veritabanına ASLA çalıştırma. Boş bir yerelde:      ║
// ║    createdb bridalstack_migcheck                                            ║
// ║    DATABASE_URL="postgresql://$USER@localhost:5432/bridalstack_migcheck" \  ║
// ║    DIRECT_URL="$DATABASE_URL" npx prisma migrate deploy                  ║
// ║    DATABASE_URL=... DIRECT_URL=... \                                     ║
// ║      node --experimental-strip-types tests/e2e/stage16-order-lines.mjs   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { PrismaClient } from "@prisma/client";
import { derivedOrderTotals, remainingBalance } from "../../lib/order-lines.ts";

const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log("  ✓", n)) : (fail++, console.log("  ✖", n)); };
const read = (id) => prisma.order.findUnique({ where: { id }, select: { list_total: true, discounted_total: true, remaining_balance: true } });

// syncOrderTotals'ın veritabanı tarafındaki aynısı (lib sunucuya bağlı olduğu için burada yeniden kurulur)
async function sync(tenantId, orderId) {
  const lines = await prisma.orderLine.findMany({ where: { order_id: orderId, order: { tenant_id: tenantId } }, select: { quantity: true, unit_price: true, discount: true } });
  const derived = derivedOrderTotals(lines);
  if (derived) await prisma.order.updateMany({ where: { id: orderId, tenant_id: tenantId }, data: derived });
  const o = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenantId }, select: { discounted_total: true, deposit_amount: true } });
  const paid = await prisma.installment.aggregate({ where: { order_id: orderId, tenant_id: tenantId, status: "paid" }, _sum: { amount: true } });
  await prisma.order.updateMany({ where: { id: orderId, tenant_id: tenantId }, data: { remaining_balance: remainingBalance(o.discounted_total, o.deposit_amount + (paid._sum.amount ?? 0)) } });
}

const u = await prisma.user.create({ data: { email: `ol${Date.now()}@x.io`, password_hash: "x" } });
const t = await prisma.tenant.create({ data: { name: "T", slug: `ol${Date.now()}`, owner_id: u.id } });
const c = await prisma.customer.create({ data: { tenant_id: t.id, name: "Bride" } });
const p = await prisma.product.create({ data: { tenant_id: t.id, name: "Gown", price: 3000 } });

// ── Kalemsiz eski sipariş bozulmaz
const legacy = await prisma.order.create({
  data: { tenant_id: t.id, ref_no: `L${Date.now()}`, customer_id: c.id, discounted_total: 4200, list_total: 4200, deposit_amount: 1000, remaining_balance: 3200 },
});
await sync(t.id, legacy.id);
let r = await read(legacy.id);
ok("kalemsiz sipariş elle girilen toplamını korudu", r.discounted_total === 4200 && r.list_total === 4200);
ok("kalemsiz siparişin bakiyesi doğru (4200 − 1000)", r.remaining_balance === 3200);

// ── Kalem eklenince toplam devralınır
const o = await prisma.order.create({
  data: { tenant_id: t.id, ref_no: `O${Date.now()}`, customer_id: c.id, discounted_total: 999, list_total: 999, deposit_amount: 500 },
});
await prisma.orderLine.create({ data: { order_id: o.id, product_id: p.id, description: "Gown", kind: "gown", quantity: 1, unit_price: 3000, discount: 200, position: 1 } });
await sync(t.id, o.id);
r = await read(o.id);
ok("ilk kalem eklenince toplam kalemden okundu (999 → 2800)", r.discounted_total === 2800 && r.list_total === 3000);
ok("bakiye yeni toplamdan hesaplandı (2800 − 500)", r.remaining_balance === 2300);

// ── İkinci kalem toplamı büyütür
await prisma.orderLine.create({ data: { order_id: o.id, description: "Veil", kind: "veil", quantity: 2, unit_price: 250, position: 2 } });
await sync(t.id, o.id);
r = await read(o.id);
ok("ikinci kalem toplama eklendi (2800 + 500)", r.discounted_total === 3300 && r.list_total === 3500);

// ── İndirim kalemi eksiye düşüremez
await prisma.orderLine.create({ data: { order_id: o.id, description: "Gift", kind: "other", quantity: 1, unit_price: 100, discount: 900, position: 3 } });
await sync(t.id, o.id);
r = await read(o.id);
ok("tavanı aşan indirim toplamı azaltmadı (kalem 0'da durdu)", r.discounted_total === 3300 && r.list_total === 3600);

// ── Ödenen taksit bakiyeyi düşürür
await prisma.installment.create({ data: { tenant_id: t.id, order_id: o.id, customer_id: c.id, installment_no: 1, total_count: 2, amount: 800, due_date: "2026-10-01", status: "paid", paid_at: new Date() } });
await sync(t.id, o.id);
r = await read(o.id);
ok("ödenen taksit bakiyeden düştü (3300 − 500 − 800)", r.remaining_balance === 2000);

// ── Fazla tahsilat bakiyeyi eksiye indirmez
await prisma.installment.create({ data: { tenant_id: t.id, order_id: o.id, customer_id: c.id, installment_no: 2, total_count: 2, amount: 9000, due_date: "2026-11-01", status: "paid", paid_at: new Date() } });
await sync(t.id, o.id);
r = await read(o.id);
ok("fazla tahsilatta bakiye eksiye inmedi", r.remaining_balance === 0);

// ── Kalem silinince toplam yeniden hesaplanır
const veil = await prisma.orderLine.findFirst({ where: { order_id: o.id, description: "Veil" } });
await prisma.orderLine.deleteMany({ where: { id: veil.id, order_id: o.id } });
await sync(t.id, o.id);
r = await read(o.id);
ok("kalem silinince toplam düştü (3300 − 500)", r.discounted_total === 2800);

// ── Sipariş silinince kalemleri de gider
const doomed = await prisma.order.create({ data: { tenant_id: t.id, ref_no: `D${Date.now()}`, customer_id: c.id } });
await prisma.orderLine.create({ data: { order_id: doomed.id, description: "X", quantity: 1, unit_price: 10 } });
await prisma.order.delete({ where: { id: doomed.id } });
ok("sipariş silinince kalemleri de silindi", (await prisma.orderLine.count({ where: { order_id: doomed.id } })) === 0);

// ── Ürün silinse de kalem okunur kalır
await prisma.product.delete({ where: { id: p.id } });
const orphan = await prisma.orderLine.findFirst({ where: { order_id: o.id, description: "Gown" } });
ok("ürün silindi ama kalem adı ve tutarı duruyor", orphan?.description === "Gown" && orphan?.product_id === null && orphan?.unit_price === 3000);
await sync(t.id, o.id);
r = await read(o.id);
ok("ürün silinmesi sipariş toplamını değiştirmedi", r.discounted_total === 2800);

// ── Kiracı izolasyonu
const t2 = await prisma.tenant.create({ data: { name: "T2", slug: `ol2${Date.now()}`, owner_id: u.id } });
ok("başka kiracı kalemleri okuyamaz", (await prisma.orderLine.count({ where: { order_id: o.id, order: { tenant_id: t2.id } } })) === 0);

console.log(`\n${pass} geçti, ${fail} kaldı`);
await prisma.$disconnect();
process.exit(fail === 0 ? 0 : 1);
