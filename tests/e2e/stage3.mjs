import { PrismaClient } from "@prisma/client";
import fs from "fs";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
const CRON = fs.readFileSync(".env.local","utf8").split("\n").find(l=>l.startsWith("CRON_SECRET=")).split("=")[1].trim();
let pass = 0, fail = 0; const out = [];
const check = (n, ok, d="") => { ok ? (pass++, out.push(`  OK   ${n}`)) : (fail++, out.push(`  FAIL ${n}${d?" — "+d:""}`)); };
const strip = h => h.replace(/<!--[\s\S]*?-->/g, "");

const run = async () => {
const tenant = await prisma.tenant.findFirst({ where: { name: { startsWith: "Full Bridal" } }, orderBy: { created_at: "desc" } });
const customer = await prisma.customer.findFirst({ where: { tenant_id: tenant.id, name: "Zeynep Kaya" } });
const order = await prisma.order.findFirst({ where: { tenant_id: tenant.id } });

// --- Sözleşme: oluştur, imzalanabilir bağlantı, imzala ---
const token = `tok${Date.now()}`;
const contract = await prisma.contract.create({
  data: { tenant_id: tenant.id, customer_id: customer.id, order_id: order.id,
    title: "Gown Purchase Agreement", content: "Terms and conditions apply.",
    total_amount: 4200, status: "sent", token },
});
{
  const res = await fetch(`${BASE}/contracts/${token}`, { redirect: "manual" });
  const html = res.status === 200 ? strip(await res.text()) : "";
  check("Sözleşme sayfası oturumsuz açılıyor", res.status === 200, `status ${res.status}`);
  check("Sözleşme başlığı görünüyor", html.includes("Gown Purchase Agreement"));
}
{
  const malformed = await fetch(`${BASE}/api/contracts/sign`, { method: "POST",
    headers: { "content-type": "application/json" }, body: "not-json" });
  check("Bozuk imza gövdesi 400 dönüyor", malformed.status === 400, `status ${malformed.status}`);
  const missingAgreement = await fetch(`${BASE}/api/contracts/sign`, { method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, signature_data: "Zeynep Kaya" }) });
  check("Onay olmadan sözleşme imzalanamıyor", missingAgreement.status === 400, `status ${missingAgreement.status}`);
  const res = await fetch(`${BASE}/api/contracts/sign`, { method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, signature_data: "Zeynep Kaya", agreement_confirmed: true }) });
  check("Sözleşme imzalanıyor", res.status < 300, `status ${res.status}`);
  const c = await prisma.contract.findUnique({ where: { id: contract.id }, select: { status: true } });
  check("Sözleşme durumu signed oldu", c?.status === "signed", `durum ${c?.status}`);
  const again = await fetch(`${BASE}/api/contracts/sign`, { method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, signature_data: "Sahte İmza", agreement_confirmed: true }) });
  check("İmzalanmış sözleşme ikinci kez imzalanamıyor", again.status === 404, `status ${again.status}`);
}
{
  const bad = await fetch(`${BASE}/contracts/gecersiz-token-123`, { redirect: "manual" });
  const badHtml = bad.status === 200 ? strip(await bad.text()) : "";
  check("Geçersiz sözleşme jetonu hata sayfası gösteriyor",
    bad.status === 200 && badHtml.includes("Contract Not Found"), `status ${bad.status}`);
}

// --- Müşteri portalı ---
const ptoken = `ptok${Date.now()}`;
await prisma.portalToken.create({
  data: { tenant_id: tenant.id, customer_id: customer.id, token: ptoken,
    expires_at: new Date(Date.now() + 7 * 864e5) },
});
{
  const res = await fetch(`${BASE}/portal/${ptoken}`, { redirect: "manual" });
  const html = res.status === 200 ? strip(await res.text()) : "";
  check("Müşteri portalı oturumsuz açılıyor", res.status === 200, `status ${res.status}`);
  check("Portal müşteri adını gösteriyor", html.includes("Zeynep Kaya"));
  const bad = await fetch(`${BASE}/portal/gecersiz-token-123`, { redirect: "manual" });
  const badHtml = bad.status === 200 ? strip(await bad.text()) : "";
  check("Geçersiz portal jetonu erişimi engelliyor",
    badHtml.includes("Link Expired") && !badHtml.includes("Zeynep Kaya"), `status ${bad.status}`);
}
{
  const expired = `exp${Date.now()}`;
  await prisma.portalToken.create({ data: { tenant_id: tenant.id, customer_id: customer.id,
    token: expired, expires_at: new Date(Date.now() - 864e5) } });
  const res = await fetch(`${BASE}/portal/${expired}`, { redirect: "manual" });
  const h = res.status === 200 ? strip(await res.text()) : "";
  check("Süresi dolmuş portal jetonu müşteri verisini sızdırmıyor",
    h.includes("Link Expired") && !h.includes("Zeynep Kaya"), `status ${res.status}`);
}

// --- Cron: doğru anahtarla çalışıyor mu ---
for (const p of ["/api/cron/installments", "/api/cron/reminders"]) {
  const res = await fetch(BASE + p, { headers: { authorization: `Bearer ${CRON}` } });
  const body = await res.json().catch(() => ({}));
  check(`${p} doğru anahtarla çalışıyor`, res.status === 200, `status ${res.status} ${JSON.stringify(body).slice(0,100)}`);
  const wrong = await fetch(BASE + p, { headers: { authorization: "Bearer yanlis" } });
  check(`${p} yanlış anahtarı reddediyor`, wrong.status === 401, `status ${wrong.status}`);
}


console.log(out.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
};
run().catch(async e => { console.error("BETİK HATASI:", e); await prisma.$disconnect(); process.exit(2); });
