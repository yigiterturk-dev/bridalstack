// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Stage 15 — satın alma: mal kabulünün stok ve kasa etkisi                ║
// ║                                                                          ║
// ║  Saf kural testleri lib/purchasing.ts'i doğrular; bu dosya akışın        ║
// ║  gerçekten veritabanında böyle davrandığını doğrular.                    ║
// ║  Kayıt YAZAR — canlı veritabanına ASLA çalıştırma. Boş bir yerelde:      ║
// ║                                                                          ║
// ║    createdb bridalstack_migcheck                                            ║
// ║    DATABASE_URL="postgresql://$USER@localhost:5432/bridalstack_migcheck" \  ║
// ║    DIRECT_URL="$DATABASE_URL" npx prisma migrate deploy                  ║
// ║    DATABASE_URL=... DIRECT_URL=... node --experimental-strip-types tests/e2e/stage15-purchasing.mjs ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { PrismaClient } from "@prisma/client";
import { receiveDelta, statusAfterReceipt, summarize, shouldPostCost } from "../../lib/purchasing.ts";

const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log("  ✓", n)) : (fail++, console.log("  ✖", n)); };
const stock = async (id) => (await prisma.product.findUnique({ where: { id }, select: { stock_quantity: true } })).stock_quantity;

const u = await prisma.user.create({ data: { email: `po${Date.now()}@x.io`, password_hash: "x" } });
const t = await prisma.tenant.create({ data: { name: "T", slug: `po${Date.now()}`, owner_id: u.id } });
const sup = await prisma.supplier.create({ data: { tenant_id: t.id, name: "Atelier", lead_time_days: 30 } });
const p1 = await prisma.product.create({ data: { tenant_id: t.id, name: "Gown A", stock_quantity: 0, cost: 200 } });
const p2 = await prisma.product.create({ data: { tenant_id: t.id, name: "Gown B", stock_quantity: 5, cost: 100 } });

const po = await prisma.purchaseOrder.create({
  data: { tenant_id: t.id, supplier_id: sup.id, ref_no: `PO-${Date.now()}`, status: "ordered", ordered_on: "2026-09-02" },
});
await prisma.purchaseOrderLine.create({ data: { po_id: po.id, product_id: p1.id, ordered_qty: 3, unit_cost: 200 } });
await prisma.purchaseOrderLine.create({ data: { po_id: po.id, product_id: p2.id, ordered_qty: 2, unit_cost: 100 } });

// ── Sipariş vermek rafı doldurmaz
ok("sipariş verildi ama raf değişmedi", (await stock(p1.id)) === 0 && (await stock(p2.id)) === 5);

// ── Kısmi kabul: yalnız fark kadar artar
const applyReceipt = async (asked) => {
  const fresh = await prisma.purchaseOrderLine.findMany({ where: { po_id: po.id }, orderBy: { ordered_qty: "desc" } });
  const moves = fresh.map((l) => ({ l, d: receiveDelta(l, asked[l.product_id] ?? l.received_qty) })).filter((m) => m.d > 0);
  const nextLines = fresh.map((l) => {
    const m = moves.find((x) => x.l.id === l.id);
    return m ? { ...l, received_qty: l.received_qty + m.d } : l;
  });
  const next = statusAfterReceipt(nextLines);
  await prisma.$transaction(async (tx) => {
    for (const { l, d } of moves) {
      const moved = await tx.purchaseOrderLine.updateMany({ where: { id: l.id, po_id: po.id, received_qty: l.received_qty }, data: { received_qty: { increment: d } } });
      if (moved.count === 0) continue;
      await tx.product.updateMany({ where: { id: l.product_id, tenant_id: t.id }, data: { stock_quantity: { increment: d } } });
    }
    await tx.purchaseOrder.updateMany({ where: { id: po.id, tenant_id: t.id }, data: { status: next } });
    if (shouldPostCost(next, nextLines)) {
      await tx.cashMovement.create({
        data: { tenant_id: t.id, direction: "out", amount: summarize(nextLines).receivedCost, method: "transfer", category: "stock", occurred_on: "2026-09-02", purchase_order_id: po.id },
      });
    }
  });
  return next;
};

let st = await applyReceipt({ [p1.id]: 1 });
ok("kısmi kabulde yalnız fark kadar arttı (0 → 1)", (await stock(p1.id)) === 1);
ok("dokunulmayan kalemin rafı değişmedi", (await stock(p2.id)) === 5);
ok("durum kalemlerden 'partial' okundu", st === "partial");
ok("kapanmadan kasaya yazılmadı", (await prisma.cashMovement.count({ where: { purchase_order_id: po.id } })) === 0);

// ── Aynı toplam ikinci kez gönderilirse raf ikinci kez dolmaz
st = await applyReceipt({ [p1.id]: 1 });
ok("aynı toplam tekrar gönderilince raf değişmedi", (await stock(p1.id)) === 1);

// ── Sipariş edilenden fazlası kabul edilmez
st = await applyReceipt({ [p1.id]: 99 });
ok("sipariş edilenden fazlası rafa girmedi (tavan 3)", (await stock(p1.id)) === 3);
ok("hâlâ eksik kalem varken kapanmadı", st === "partial");

// ── Tamamlanınca kapanır ve teslim alınanın bedeli bir kez kasaya yazılır
st = await applyReceipt({ [p2.id]: 2 });
ok("hepsi gelince durum 'received'", st === "received");
ok("ikinci kalemin rafı arttı (5 → 7)", (await stock(p2.id)) === 7);

const posted = await prisma.cashMovement.findMany({ where: { purchase_order_id: po.id } });
ok("kapanışta tek bir kasa kaydı doğdu", posted.length === 1);
ok("tutar teslim alınanın maliyeti (3×200 + 2×100 = 800)", posted[0]?.amount === 800);
ok("gider yönü ve kategorisi doğru", posted[0]?.direction === "out" && posted[0]?.category === "stock");

// ── Mal bedeli ikinci kez yazılamaz
let blocked = false;
try {
  await prisma.cashMovement.create({ data: { tenant_id: t.id, direction: "out", amount: 800, category: "stock", occurred_on: "2026-09-03", purchase_order_id: po.id } });
} catch { blocked = true; }
ok("aynı sipariş iki kez kasaya yazılamaz", blocked);

// ── Aynı ürün siparişte iki satır olamaz
let dup = false;
try { await prisma.purchaseOrderLine.create({ data: { po_id: po.id, product_id: p1.id, ordered_qty: 1 } }); } catch { dup = true; }
ok("aynı ürün siparişte iki kez listelenemez", dup);

// ── Kiracı izolasyonu
const t2 = await prisma.tenant.create({ data: { name: "T2", slug: `po2${Date.now()}`, owner_id: u.id } });
ok("başka kiracı siparişi göremez", (await prisma.purchaseOrder.findFirst({ where: { id: po.id, tenant_id: t2.id } })) === null);

console.log(`\n${pass} geçti, ${fail} kaldı`);
await prisma.$disconnect();
process.exit(fail === 0 ? 0 : 1);
