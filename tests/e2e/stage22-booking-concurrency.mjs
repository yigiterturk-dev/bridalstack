import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
let pass = 0;
let fail = 0;
const out = [];
const check = (name, ok, detail = "") => {
  if (ok) { pass++; out.push(`  OK   ${name}`); }
  else { fail++; out.push(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
};

const stamp = Date.now();
const email = `booking-lock-${stamp}@example.com`;
const password = "Str0ngPass!234";

async function run() {
  const registration = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, shopName: `Lock Bridal ${stamp}` }),
  });
  const user = await prisma.user.findUnique({ where: { email } });
  const tenant = user && await prisma.tenant.findFirst({ where: { owner_id: user.id } });
  const member = tenant && await prisma.tenantMember.findFirst({ where: { tenant_id: tenant.id } });
  const service = tenant && await prisma.service.create({
    data: { tenant_id: tenant.id, name: "Concurrency Fitting", duration: 60, price: 0, is_active: true },
  });

  check("Test kiracısı ve booking kaynakları hazır", registration.status === 201 && Boolean(tenant && member && service));
  if (!tenant || !member || !service) throw new Error("Booking test fixtures could not be created");

  await prisma.tenantMember.update({ where: { id: member.id }, data: { is_bookable: true } });
  const date = new Date(Date.now() + 4 * 864e5).toISOString().split("T")[0];
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  await prisma.staffSchedule.upsert({
    where: { member_id_day_of_week: { member_id: member.id, day_of_week: dayOfWeek } },
    update: { tenant_id: tenant.id, start_time: "09:00", end_time: "18:00", break_start: null, break_end: null, is_off: false },
    create: { tenant_id: tenant.id, member_id: member.id, day_of_week: dayOfWeek, start_time: "09:00", end_time: "18:00", is_off: false },
  });
  const payload = {
    tenant_id: tenant.id,
    service_id: service.id,
    customer_name: "Concurrent Bride",
    customer_phone: "+1 212 555 0199",
    customer_email: `concurrent-${stamp}@example.com`,
    booking_date: date,
    start_time: "11:00",
    end_time: "12:00",
  };

  const malformed = await fetch(`${BASE}/api/book`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-json",
  });
  check("Bozuk booking gövdesi 400 döndürüyor", malformed.status === 400, `status ${malformed.status}`);

  const nonObjectBody = await fetch(`${BASE}/api/book`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "null",
  });
  check("Null booking gövdesi 400 döndürüyor", nonObjectBody.status === 400, `status ${nonObjectBody.status}`);

  const invalidMember = await fetch(`${BASE}/api/book`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, member_id: "not-a-uuid" }),
  });
  check("Bozuk staff kimliği 400 döndürüyor", invalidMember.status === 400, `status ${invalidMember.status}`);

  const outsideHours = await fetch(`${BASE}/api/book`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, member_id: member.id, start_time: "08:00", end_time: "09:00" }),
  });
  check("Mesai dışı booking API tarafından reddediliyor", outsideHours.status === 409, `status ${outsideHours.status}`);

  const responses = await Promise.all([
    fetch(`${BASE}/api/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }),
    fetch(`${BASE}/api/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }),
  ]);
  const statuses = responses.map((response) => response.status).sort((a, b) => a - b);
  check("Eşzamanlı aynı slot isteklerinden biri kabul ediliyor", statuses.filter((status) => status === 200).length === 1, statuses.join(","));
  check("Eşzamanlı aynı slot isteklerinden biri 409 ile reddediliyor", statuses.filter((status) => status === 409).length === 1, statuses.join(","));

  const bookings = await prisma.booking.findMany({
    where: { tenant_id: tenant.id, customer_email: payload.customer_email },
    select: { status: true, member_id: true },
  });
  const customers = await prisma.customer.count({ where: { tenant_id: tenant.id, email: payload.customer_email } });
  check("Yalnızca bir pending booking yazılıyor", bookings.length === 1 && bookings[0]?.status === "pending");
  check("No-preference booking sunucuda bookable personele atanıyor", bookings[0]?.member_id === member.id);
  check("Eşzamanlı istekler tek müşteri profili üretiyor", customers === 1, `müşteri sayısı ${customers}`);

  console.log(out.join("\n"));
  console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}

run().catch(async (error) => {
  console.error("BETİK HATASI:", error);
  await prisma.$disconnect();
  process.exit(2);
});
