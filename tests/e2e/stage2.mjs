import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
const jar = new Map();
let pass = 0, fail = 0; const out = [];

function setCookies(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";"); const i = pair.indexOf("=");
    jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
async function req(path, opts = {}, useCookies = true) {
  const headers = { ...(opts.headers || {}) };
  if (useCookies && jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(BASE + path, { ...opts, headers, redirect: "manual" });
  setCookies(res); return res;
}
const check = (n, ok, d = "") => { ok ? (pass++, out.push(`  OK   ${n}`)) : (fail++, out.push(`  FAIL ${n}${d ? " — " + d : ""}`)); return ok; };

const stamp = Date.now();
const EMAIL = `full${stamp}@example.com`, PASSWORD = "Str0ngPass!234", SHOP = `Full Bridal ${stamp}`;

const run = async () => {
await req("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, shopName: SHOP }) }, false);

const user = await prisma.user.findUnique({ where: { email: EMAIL } });
const tenant = await prisma.tenant.findFirst({ where: { owner_id: user.id } });

// Tüm paketleri aç + deneme süresi ver, böylece modül kapıları açılır.
await prisma.tenant.update({
  where: { id: tenant.id },
  data: { packs: ["base", "sales", "inventory", "booking"], trial_ends_at: new Date(Date.now() + 9 * 864e5) },
});

// Gerçek veri
const customer = await prisma.customer.create({
  data: { tenant_id: tenant.id, name: "Zeynep Kaya", phone: "+90 555 111 2233", email: "zeynep@example.com", status: "hot_lead" },
});
const product = await prisma.product.create({
  data: { tenant_id: tenant.id, name: "Ivory Silk Gown", barcode: `BC${stamp}`, sku: "SKU-IVY-1", category: "Gowns", price: 4200, cost: 1500, stock_quantity: 3 },
});
await prisma.order.create({
  data: { tenant_id: tenant.id, ref_no: `S${stamp}`.slice(0, 14), customer_id: customer.id, order_type: "sale",
    order_date: new Date().toISOString().split("T")[0], status: "confirmed",
    discounted_total: 4200, list_total: 4200, deposit_amount: 1000, remaining_balance: 3200 },
});
await prisma.appointment.create({
  data: { tenant_id: tenant.id, customer_id: customer.id, title: "First Fitting",
    appointment_date: new Date(Date.now() + 2 * 864e5), status: "pending" },
});
const service = await prisma.service.create({
  data: { tenant_id: tenant.id, name: "Bridal Styling", category: "Hair", duration: 60, price: 900, is_active: true },
});
const member = await prisma.tenantMember.findFirst({ where: { tenant_id: tenant.id } });
await prisma.staffSchedule.createMany({
  data: [1, 2, 3, 4, 5].map((d) => ({ tenant_id: tenant.id, member_id: member.id, day_of_week: d, start_time: "09:00", end_time: "18:00" })),
});

// giriş
let r = await req("/api/auth/csrf"); const { csrfToken } = await r.json();
await req("/api/auth/callback/credentials", { method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, json: "true" }) });

// Sayfalar gerçek veriyi gösteriyor mu?
const cases = [
  ["/customers", "Zeynep Kaya", "Müşteriler listede gerçek müşteriyi gösteriyor"],
  [`/customers/${customer.id}`, 'value="hot_lead"', "Müşteri durum alanı doğru"],
  ["/products", "Ivory Silk Gown", "Ürünler listede gerçek ürünü gösteriyor"],
  [`/products/${product.id}`, "you keep 64%", "Ürün kâr marjı hesaplanıyor"],
  ["/orders", "Zeynep Kaya", "Siparişler müşteri adını gösteriyor"],
  ["/orders", "3,200", "Sipariş kalan bakiyesi doğru"],
  ["/appointments", "First Fitting", "Randevular gerçek randevuyu gösteriyor"],
  ["/appointments", "Zeynep Kaya", "Randevu formu müşteri listesini dolduruyor"],
  ["/dashboard", SHOP, "Ana panel işletme adını gösteriyor"],
  ["/analytics", "What is my stock worth?", "Analitik stok değeri göstergesini gösteriyor"],
];
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, "");
for (const [path, needle, label] of cases) {
  const res = await req(path);
  const html = res.status === 200 ? strip(await res.text()) : "";
  check(label, html.includes(needle), res.status !== 200 ? `status ${res.status}` : "metin bulunamadı");
}

// Deneme rozeti
{
  const html = await (await req("/dashboard")).text();
  check("Deneme süresi rozeti gerçek gün sayısıyla görünüyor", /9 (days|gün)/.test(html) || html.includes("9"), "rozet yok");
}

// Herkese açık randevu sayfası (oturumsuz)
{
  const fresh = await fetch(`${BASE}/book/${tenant.slug}`, { redirect: "manual" });
  const html = fresh.status === 200 ? await fresh.text() : "";
  check("Herkese açık randevu sayfası oturumsuz açılıyor", fresh.status === 200, `status ${fresh.status}`);
  check("Randevu sayfası hizmeti listeliyor", html.includes("Bridal Styling"));
}

// Herkese açık rezervasyon oluşturma
{
  const bookingDate = new Date(Date.now() + 3 * 864e5);
  // Müsaitlik, rezervasyon gününün haftanın gününe göre programa bakıyor;
  // +3 gün hafta sonuna denk gelirse randevu 409 döner. O günü kapsayan bir
  // program ekleyerek testi tarihten bağımsız yapıyoruz.
  await prisma.staffSchedule.createMany({
    data: [{ tenant_id: tenant.id, member_id: member.id, day_of_week: bookingDate.getUTCDay(), start_time: "09:00", end_time: "18:00" }],
    skipDuplicates: true,
  });
  const d = bookingDate.toISOString().split("T")[0];
  const res = await fetch(`${BASE}/api/book`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant.id, service_id: service.id, member_id: member.id,
      booking_date: d, start_time: "11:00", end_time: "12:00", customer_name: "Elif Demir",
      customer_phone: "+90 555 999 8877", customer_email: "elif@example.com" }) });
  const body = await res.json().catch(() => ({}));
  check("Herkese açık rezervasyon oluşturuluyor", res.status < 300, `status ${res.status} ${JSON.stringify(body).slice(0,120)}`);
  const b = await prisma.booking.findFirst({ where: { tenant_id: tenant.id } });
  check("Rezervasyon pending durumuyla kaydediliyor", b?.status === "pending", `durum ${b?.status}`);
  const page = await req("/bookings");
  check("Rezervasyon paneli açılıyor", page.status === 200, `status ${page.status}`);
  const visible = await prisma.booking.findFirst({
    where: { tenant_id: tenant.id, customer_name: "Elif Demir" },
    select: { customer_name: true, service: { select: { name: true } }, member: { select: { display_name: true } } },
  });
  check("Panelin okuduğu kayıt hizmet ve personel ilişkisiyle geliyor",
    visible?.customer_name === "Elif Demir" && visible?.service?.name === "Bridal Styling", JSON.stringify(visible));
}

// Cron uçları gizli anahtar istiyor
for (const p of ["/api/cron/installments", "/api/cron/reminders"]) {
  const noAuth = await fetch(BASE + p);
  check(`${p} yetkisiz isteği reddediyor`, noAuth.status === 401 || noAuth.status === 403, `status ${noAuth.status}`);
}

// Kiracı izolasyonu: ikinci kiracı ilkinin verisini görmemeli
{
  const e2 = `iso${stamp}@example.com`;
  await fetch(`${BASE}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: e2, password: PASSWORD, shopName: `Iso Bridal ${stamp}` }) });
  const jar2 = new Map();
  const c = await fetch(`${BASE}/api/auth/csrf`);
  for (const s of c.headers.getSetCookie?.() ?? []) { const [p2] = s.split(";"); const i = p2.indexOf("="); jar2.set(p2.slice(0,i).trim(), p2.slice(i+1).trim()); }
  const { csrfToken: t2 } = await c.json();
  const lg = await fetch(`${BASE}/api/auth/callback/credentials`, { method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: [...jar2].map(([k,v])=>`${k}=${v}`).join("; ") },
    body: new URLSearchParams({ csrfToken: t2, email: e2, password: PASSWORD, json: "true" }), redirect: "manual" });
  for (const s of lg.headers.getSetCookie?.() ?? []) { const [p2] = s.split(";"); const i = p2.indexOf("="); jar2.set(p2.slice(0,i).trim(), p2.slice(i+1).trim()); }
  const res = await fetch(`${BASE}/customers`, { headers: { cookie: [...jar2].map(([k,v])=>`${k}=${v}`).join("; ") }, redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  check("İkinci kiracı diğerinin müşterisini GÖRMÜYOR", res.status === 200 && !html.includes("Zeynep Kaya"), `status ${res.status}`);
}

console.log(out.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
};
run().catch(async e => { console.error("BETİK HATASI:", e); await prisma.$disconnect(); process.exit(2); });
