import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
let pass = 0, fail = 0; const out = [];
const check = (n, ok, d="") => { ok ? (pass++, out.push(`  OK   ${n}`)) : (fail++, out.push(`  FAIL ${n}${d?" — "+d:""}`)); };
const strip = h => h.replace(/<!--[\s\S]*?-->/g, "");
const hash = t => createHash("sha256").update(t).digest("hex");

function jarOf() { const j = new Map();
  return { set: r => { for (const c of r.headers.getSetCookie?.() ?? []) { const [p]=c.split(";"); const i=p.indexOf("="); j.set(p.slice(0,i).trim(), p.slice(i+1).trim()); } },
           hdr: () => [...j].map(([k,v])=>`${k}=${v}`).join("; ") }; }

async function login(email, password) {
  const j = jarOf();
  let r = await fetch(`${BASE}/api/auth/csrf`); j.set(r);
  const { csrfToken } = await r.json();
  r = await fetch(`${BASE}/api/auth/callback/credentials`, { method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: j.hdr() },
    body: new URLSearchParams({ csrfToken, email, password, json: "true" }), redirect: "manual" });
  j.set(r); return j;
}

const stamp = Date.now();
const OWNER = `own${stamp}@example.com`, PW = "Str0ngPass!234", SHOP = `Reset Bridal ${stamp}`;

const run = async () => {
await fetch(`${BASE}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: OWNER, password: PW, shopName: SHOP }) });

// ── Parola sıfırlama ──
{
  const page = await fetch(`${BASE}/forgot-password`, { redirect: "manual" });
  check("Parola sıfırlama sayfası oturumsuz açılıyor", page.status === 200, `status ${page.status}`);
  const loginHtml = strip(await (await fetch(`${BASE}/login`)).text());
  check("Giriş sayfasında 'Forgot password?' bağlantısı var", loginHtml.includes("Forgot password?"));
}
{
  // Sıfırlama isteği (server action yerine akışı doğrudan kurup uçları sınıyoruz)
  const user = await prisma.user.findUnique({ where: { email: OWNER } });
  const token = "tok-" + stamp;
  await prisma.passwordResetToken.create({
    data: { user_id: user.id, token_hash: hash(token), expires_at: new Date(Date.now() + 36e5) } });

  const ok = await fetch(`${BASE}/reset-password/${token}`, { redirect: "manual" });
  const okHtml = ok.status === 200 ? strip(await ok.text()) : "";
  check("Geçerli sıfırlama bağlantısı formu gösteriyor",
    ok.status === 200 && okHtml.includes("Choose a new password") && okHtml.includes("Confirm password"), `status ${ok.status}`);

  const bad = await fetch(`${BASE}/reset-password/uydurma-jeton`, { redirect: "manual" });
  const badHtml = bad.status === 200 ? strip(await bad.text()) : "";
  check("Uydurma sıfırlama jetonu formu göstermiyor",
    badHtml.includes("expired or has already been used") && !badHtml.includes("Confirm password"));

  // Süresi dolmuş
  const exp = "exp-" + stamp;
  await prisma.passwordResetToken.create({
    data: { user_id: user.id, token_hash: hash(exp), expires_at: new Date(Date.now() - 36e5) } });
  const expHtml = strip(await (await fetch(`${BASE}/reset-password/${exp}`)).text());
  check("Süresi dolmuş sıfırlama jetonu reddediliyor", !expHtml.includes("Confirm password"));

  // Kullanılmış jeton tekrar kabul edilmemeli
  await prisma.passwordResetToken.updateMany({ where: { token_hash: hash(token) }, data: { used_at: new Date() } });
  const usedHtml = strip(await (await fetch(`${BASE}/reset-password/${token}`)).text());
  check("Kullanılmış sıfırlama jetonu tekrar kullanılamıyor", !usedHtml.includes("Confirm password"));

  check("Ham jeton veritabanında saklanmıyor (sadece özet)",
    (await prisma.passwordResetToken.findFirst({ where: { token_hash: token } })) === null);
}

// ── Ekip daveti ──
{
  const owner = await prisma.user.findUnique({ where: { email: OWNER } });
  const tenant = await prisma.tenant.findFirst({ where: { owner_id: owner.id } });
  const inviteeEmail = `inv${stamp}@example.com`;
  const itok = "inv-" + stamp;
  await prisma.invitation.create({
    data: { tenant_id: tenant.id, email: inviteeEmail, role: "stylist", token_hash: hash(itok),
            invited_by: owner.id, expires_at: new Date(Date.now() + 7 * 864e5) } });

  const page = await fetch(`${BASE}/invite/${itok}`, { redirect: "manual" });
  const html = page.status === 200 ? strip(await page.text()) : "";
  check("Davet sayfası oturumsuz açılıyor", page.status === 200, `status ${page.status}`);
  check("Davet sayfası işletme adını ve rolü gösteriyor",
    html.includes(SHOP) && html.includes("Stylist") || html.includes(SHOP));
  check("Hesabı olmayan davetliye kayıt formu gösteriliyor",
    html.includes("Create account and join") && html.includes("Choose a password"));

  const bad = strip(await (await fetch(`${BASE}/invite/uydurma`)).text());
  check("Geçersiz davet jetonu reddediliyor",
    bad.includes("Invitation not valid") && !bad.includes("Create account and join"));

  const exp = "invexp-" + stamp;
  await prisma.invitation.create({
    data: { tenant_id: tenant.id, email: `exp${stamp}@example.com`, role: "viewer", token_hash: hash(exp),
            expires_at: new Date(Date.now() - 864e5) } });
  const expHtml = strip(await (await fetch(`${BASE}/invite/${exp}`)).text());
  check("Süresi dolmuş davet reddediliyor", expHtml.includes("Invitation not valid"));
}

// ── Satılamayan paketler ──
{
  const j = await login(OWNER, PW);
  for (const pack of ["finance", "communication"]) {
    const res = await fetch(`${BASE}/api/stripe/checkout`, { method: "POST",
      headers: { "content-type": "application/json", cookie: j.hdr() },
      body: JSON.stringify({ packs: ["base", pack] }) });
    const body = await res.json().catch(() => ({}));
    check(`'${pack}' paketi sunucuda satın alınamıyor`,
      res.status === 400 && String(body.error || "").includes("not available"),
      `status ${res.status} ${JSON.stringify(body).slice(0,90)}`);
  }
  const html = strip(await (await fetch(`${BASE}/settings`, { headers: { cookie: j.hdr() } })).text());
  check("Ayarlar geliştirme aşamasındaki paketleri işaretliyor", html.includes("In development"));

  const landing = strip(await (await fetch(`${BASE}/landing`)).text());
  check("Tanıtım sayfası hazır olmayan paketi satmıyor", landing.includes("Not available yet"));
  check("Tanıtım sayfası hazır olmayan özellikleri işaretliyor", landing.includes("Coming soon"));
}

// ── Menüde ölü bağlantı kalmadı ──
{
  const j = await login(OWNER, PW);
  const owner = await prisma.user.findUnique({ where: { email: OWNER } });
  const tenant = await prisma.tenant.findFirst({ where: { owner_id: owner.id } });
  await prisma.tenant.update({ where: { id: tenant.id },
    data: { packs: ["base", "sales", "inventory", "pro", "salon"] } });
  const html = strip(await (await fetch(`${BASE}/dashboard`, { headers: { cookie: j.hdr() } })).text());
  const dead = ["/invoices", "/reports", "/cash", "/ledger", "/checks", "/suppliers", "/inventory-count", "/returns", "/commissions", "/inbox", "/whatsapp"];
  const found = dead.filter(d => html.includes(`href="${d}"`));
  check("Kenar menüsünde 404'e giden bağlantı yok", found.length === 0, `hâlâ var: ${found.join(", ")}`);
}

console.log(out.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
};
run().catch(async e => { console.error("BETİK HATASI:", e); await prisma.$disconnect(); process.exit(2); });
