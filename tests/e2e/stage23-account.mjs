// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Stage 23 — hesap yaşam döngüsü: veri dışa aktarma ve kalıcı silme.      ║
// ║                                                                          ║
// ║  Kayıt YAZAR — canlı veritabanına ASLA çalıştırma. Boş bir yerelde:      ║
// ║    createdb bridalstack_e2e_iso && ... npx prisma migrate deploy         ║
// ║    DATABASE_URL=... DIRECT_URL=... node tests/e2e/stage23-account.mjs    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { PrismaClient } from "@prisma/client";
import { deleteAccountData, exportTenantData } from "../../lib/account.ts";

const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log("  ✓", n)) : (fail++, console.log("  ✖", n)); };
const stamp = Date.now();

// ── Sahip senaryosu: hesap silinince kiracı ve tüm verisi gider ──
{
  const user = await prisma.user.create({ data: { email: `owner-${stamp}@x.io`, password_hash: "x" } });
  const tenant = await prisma.tenant.create({ data: { name: "Del Shop", slug: `del-${stamp}`, owner_id: user.id } });
  await prisma.tenantMember.create({ data: { tenant_id: tenant.id, user_id: user.id, role: "owner" } });
  const customer = await prisma.customer.create({ data: { tenant_id: tenant.id, name: "Bride" } });
  const product = await prisma.product.create({ data: { tenant_id: tenant.id, name: "Gown", stock_quantity: 1 } });
  await prisma.service.create({ data: { tenant_id: tenant.id, name: "Fitting", duration: 60, price: 0, is_active: true } });
  await prisma.booking.create({ data: { tenant_id: tenant.id, customer_id: customer.id, customer_name: "Bride", booking_date: "2026-11-01", start_time: "10:00", end_time: "11:00", status: "pending" } });

  const exported = await exportTenantData(tenant.id);
  ok("dışa aktarma kiracıyı ve müşteriyi içeriyor", exported.tenant?.id === tenant.id && exported.customers.length === 1);
  ok("dışa aktarma ürün ve randevu akışını içeriyor", exported.products.length === 1 && exported.bookings.length === 1);

  const result = await deleteAccountData(user.id);
  ok("sahip olunan kiracı sayısı raporlanıyor", result.deletedTenants === 1);

  ok("kiracı silindi", (await prisma.tenant.findUnique({ where: { id: tenant.id } })) === null);
  ok("müşteri cascade ile silindi", (await prisma.customer.count({ where: { tenant_id: tenant.id } })) === 0);
  ok("ürün cascade ile silindi", (await prisma.product.findFirst({ where: { id: product.id } })) === null);
  ok("randevu cascade ile silindi", (await prisma.booking.count({ where: { tenant_id: tenant.id } })) === 0);
  ok("kullanıcı silindi", (await prisma.user.findUnique({ where: { id: user.id } })) === null);
  ok("üyelik kaydı kalmadı", (await prisma.tenantMember.count({ where: { user_id: user.id } })) === 0);
}

// ── Üye senaryosu: başka kiracının verisi etkilenmez ──
{
  const other = await prisma.user.create({ data: { email: `other-${stamp}@x.io`, password_hash: "x" } });
  const otherTenant = await prisma.tenant.create({ data: { name: "Other Shop", slug: `other-${stamp}`, owner_id: other.id } });
  const memberUser = await prisma.user.create({ data: { email: `member-${stamp}@x.io`, password_hash: "x" } });
  await prisma.tenantMember.create({ data: { tenant_id: otherTenant.id, user_id: memberUser.id, role: "member" } });
  const otherCustomer = await prisma.customer.create({ data: { tenant_id: otherTenant.id, name: "Keep Me" } });

  const result = await deleteAccountData(memberUser.id);
  ok("üye sadece üyelikleriyle silindi (kiracı silinmedi)", result.deletedTenants === 0);
  ok("üye kullanıcısı silindi", (await prisma.user.findUnique({ where: { id: memberUser.id } })) === null);
  ok("davetli üyelik kaydı kalktı", (await prisma.tenantMember.count({ where: { user_id: memberUser.id } })) === 0);
  ok("diğer kiracı ve verisi duruyor",
    (await prisma.tenant.findUnique({ where: { id: otherTenant.id } })) !== null &&
    (await prisma.customer.findFirst({ where: { id: otherCustomer.id } })) !== null);

  await prisma.customer.deleteMany({ where: { tenant_id: otherTenant.id } });
  await prisma.tenant.delete({ where: { id: otherTenant.id } });
  await prisma.user.delete({ where: { id: other.id } });
}

console.log(`\n  ${pass} geçti, ${fail} kaldı`);
await prisma.$disconnect();
process.exit(fail > 0 ? 1 : 0);
