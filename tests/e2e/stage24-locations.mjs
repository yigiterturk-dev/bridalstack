// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Stage 24 — çok şube (çok kiracılı üyelik) ve aktif şube seçimi           ║
// ║                                                                          ║
// ║  Bir kullanıcı birden çok kiracıya üye olabilir (her şube ayrı çalışma   ║
// ║  alanıdır). `bs_tenant` çerezi yalnızca HANGİ üyeliğin aktif olduğunu     ║
// ║  söyler; üye olunmayan bir kiracı çerezle seçilemez.                     ║
// ║                                                                          ║
// ║  Kayıt YAZAR — canlı veritabanına ASLA çalıştırma.                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
let pass = 0, fail = 0;
const out = [];
const check = (name, ok, detail = "") => {
  ok ? (pass++, out.push(`  OK   ${name}`)) : (fail++, out.push(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`));
};

const stamp = Date.now();
const EMAIL = `loc${stamp}@example.com`;
const PW = "Str0ngPass!234";
const SHOP_A = `Loc Base ${stamp}`;
const SHOP_B = `Loc Second ${stamp}`;
const SHOP_C = `Loc Secret ${stamp}`;

const jar = new Map();
const setCookies = (res) => {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
};
const cookieHeader = (tenantId) => {
  const base = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  return tenantId ? `${base}; bs_tenant=${tenantId}` : base;
};

const run = async () => {
  await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PW, shopName: SHOP_A }),
  });

  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  const tenantA = await prisma.tenant.findFirst({ where: { owner_id: user.id } });

  const tenantB = await prisma.tenant.create({
    data: { name: SHOP_B, slug: `loc-second-${stamp}`, owner_id: user.id, packs: ["base", "salon"] },
  });
  await prisma.tenantMember.create({ data: { tenant_id: tenantB.id, user_id: user.id, role: "owner" } });

  const other = await prisma.user.create({ data: { email: `locother${stamp}@example.com`, password_hash: "x" } });
  const tenantC = await prisma.tenant.create({
    data: { name: SHOP_C, slug: `loc-secret-${stamp}`, owner_id: other.id, packs: ["base"] },
  });
  await prisma.tenantMember.create({ data: { tenant_id: tenantC.id, user_id: other.id, role: "owner" } });

  // ── Giriş ──
  let res = await fetch(`${BASE}/api/auth/csrf`);
  setCookies(res);
  const { csrfToken } = await res.json();
  res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PW, json: "true" }),
    redirect: "manual",
  });
  setCookies(res);

  const page = async (path, tenantId) => {
    const r = await fetch(BASE + path, { headers: { cookie: cookieHeader(tenantId) }, redirect: "manual" });
    return r.status === 200 ? r.text() : "";
  };

  // Aktif şube adı kenar çubuğunun başlığındadır; şube seçici tüm şubeleri
  // (doğal olarak) listelediği için "sayfada ad geçiyor mu" ölçütü yanıltıcı.
  const activeName = (html) =>
    html.match(/<p class="[^"]*uppercase[^"]*">([^<]*)<\/p>/)?.[1]?.trim() ?? "";

  // ── A seçili ──
  const htmlA = await page("/dashboard", tenantA.id);
  check("A aktifken başlık A", activeName(htmlA) === SHOP_A, activeName(htmlA));
  check("A aktifken başlık B değil", activeName(htmlA) !== SHOP_B, activeName(htmlA));

  // ── B'ye geç ──
  const htmlB = await page("/dashboard", tenantB.id);
  check("B aktifken başlık B", activeName(htmlB) === SHOP_B, activeName(htmlB));
  check("B aktifken başlık A değil", activeName(htmlB) !== SHOP_A, activeName(htmlB));

  // ── Üye olunmayan C çerezi yok sayılır ──
  const htmlC = await page("/dashboard", tenantC.id);
  check("üye olunmayan şube çerezle açılmaz", !htmlC.includes(SHOP_C));
  check("geçersiz çerez ilk üyeliğe düşer", activeName(htmlC) === SHOP_A, activeName(htmlC));

  // ── Şube listesi iki üyeliği de gösterir ──
  const htmlLocations = await page("/locations", tenantB.id);
  check("/locations iki şubeyi listeler", htmlLocations.includes(SHOP_A) && htmlLocations.includes(SHOP_B));
};

run()
  .catch((error) => {
    console.error("BETİK HATASI:", error);
    fail++;
  })
  .finally(async () => {
    console.log(out.join("\n"));
    console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
    await prisma.$disconnect();
    process.exit(fail ? 1 : 0);
  });
