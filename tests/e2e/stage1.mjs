import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
const jar = new Map();
let pass = 0, fail = 0;
const results = [];

function setCookies(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function req(path, opts = {}, useCookies = true) {
  const headers = { ...(opts.headers || {}) };
  if (useCookies && jar.size) headers.cookie = cookieHeader();
  const res = await fetch(BASE + path, { ...opts, headers, redirect: "manual" });
  setCookies(res);
  return res;
}

function check(name, ok, detail = "") {
  if (ok) { pass++; results.push(`  OK   ${name}`); }
  else { fail++; results.push(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
  return ok;
}

const stamp = Date.now();
const EMAIL = `owner${stamp}@example.com`;
const PASSWORD = "Str0ngPass!234";
const SHOP = `Test Bridal ${stamp}`;

const run = async () => {
// Geçersiz gövde, genel sunucu hatasına dönüşmemeli.
let malformed = await req("/api/auth/register", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "not-json",
}, false);
check("Bozuk kayıt gövdesi 400 döndürüyor", malformed.status === 400, `status ${malformed.status}`);

// 1 — kayıt
let r = await req("/api/auth/register", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, shopName: SHOP }),
}, false);
check("Kayıt 201 döndürüyor", r.status === 201, `status ${r.status}`);

// 2 — aynı e-posta ikinci kez reddediliyor
r = await req("/api/auth/register", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, shopName: SHOP }),
}, false);
check("Yinelenen e-posta reddediliyor", r.status === 400, `status ${r.status}`);

// 3 — korumalı rota oturumsuz login'e yönleniyor
r = await req("/customers", {}, false);
check("Oturumsuz /customers login'e yönleniyor",
  r.status === 307 && (r.headers.get("location") || "").includes("/login"),
  `${r.status} -> ${r.headers.get("location")}`);

// 4 — giriş
r = await req("/api/auth/csrf");
const { csrfToken } = await r.json();
check("CSRF jetonu alınıyor", Boolean(csrfToken));

r = await req("/api/auth/callback/credentials", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, json: "true" }),
});
const hasSession = [...jar.keys()].some(k => k.includes("session-token"));
check("Giriş oturum çerezi bırakıyor", hasSession, `status ${r.status}`);

// 5 — yanlış şifre reddediliyor
{
  const tmp = new Map(jar);
  jar.clear();
  let c = await req("/api/auth/csrf");
  const { csrfToken: t2 } = await c.json();
  const bad = await req("/api/auth/callback/credentials", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken: t2, email: EMAIL, password: "wrong", json: "true" }),
  });
  const body = await bad.text();
  check("Yanlış şifre reddediliyor", body.includes("error") || bad.status >= 400, `status ${bad.status}`);
  jar.clear(); for (const [k, v] of tmp) jar.set(k, v);
}

// 6 — panel sayfaları oturumla açılıyor ve işletme adını gösteriyor
for (const [path, label] of [["/dashboard","Ana panel"],["/customers","Müşteriler"],["/products","Ürünler"],["/orders","Siparişler"],["/appointments","Randevular"],["/analytics","Analitik"],["/settings","Ayarlar"],["/bookings","Rezervasyonlar"]]) {
  const res = await req(path);
  const html = res.status === 200 ? await res.text() : "";
  check(`${label} sayfası 200 dönüyor`, res.status === 200, `status ${res.status}`);
  if (res.status === 200) {
    check(`${label} sayfasında sahte veri yok`,
      !html.includes("Elegance Bridal") && !html.includes("Olivia Reynolds") && !html.includes("Valentina Gown"),
      "eski demo verisi hâlâ görünüyor");
  }
}

// 7 — boş durum mesajları
{
  const html = await (await req("/customers")).text();
  check("Müşteriler boş durumu gösteriyor", html.includes("No brides yet"));
  // Kayıt tüm satılabilir paketlerde deneme açıyor; modül kapısını sınamak
  // için denemeyi sonlandırıyoruz (deneme dolunca modüller kendiliğinden kapanır).
  const owner = await prisma.user.findUnique({ where: { email: EMAIL } });
  const tenant = await prisma.tenant.findFirst({ where: { owner_id: owner.id } });
  await prisma.tenant.update({ where: { id: tenant.id }, data: { trial_ends_at: new Date(Date.now() - 1000) } });
  // Base paketinde sales modülü yok; sipariş sayfası doğru şekilde yükseltme çağrısı gösterir.
  const h2 = await (await req("/orders")).text();
  check("Sipariş sayfası pakete dahil olmayan modül için yükseltme çağrısı gösteriyor",
    h2.includes("not part of your current plan"));
}

// 8 — ayarlar gerçek işletme adını ve randevu bağlantısını gösteriyor
{
  const html = await (await req("/settings")).text();
  check("Ayarlar işletme adını gösteriyor", html.includes(SHOP));
  check("Ayarlar randevu bağlantısını gösteriyor", html.includes("/book/"));
  check("Ayarlar çıkış düğmesini gösteriyor", html.includes("Sign Out"));
}

console.log(results.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
console.log(`HESAP: ${EMAIL} / ${PASSWORD}`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
};
run().catch(async e => { console.error("BETİK HATASI:", e); await prisma.$disconnect(); process.exit(2); });
