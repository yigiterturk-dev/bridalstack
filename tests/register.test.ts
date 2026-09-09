import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRegistration, pickUniqueSlug, slugBase } from "../lib/register.ts";

test("geçerli kayıt: e-posta küçültülür, boşluklar kırpılır", () => {
  const r = validateRegistration({ email: "  A@B.com ", password: "12345678", shopName: " Elegance " });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.email, "a@b.com");
    assert.equal(r.shopName, "Elegance");
  }
});

test("e-posta biçimi kötüyse reddeder", () => {
  for (const email of ["", "abc", "a@b", "@x.com", "a b@c.com"]) {
    const r = validateRegistration({ email, password: "12345678", shopName: "Boutique" });
    assert.equal(r.ok, false, `kabul edilmemeli: ${email}`);
  }
});

test("kısa şifre reddeder (<8)", () => {
  const r = validateRegistration({ email: "a@b.co", password: "1234567", shopName: "Boutique" });
  assert.equal(r.ok, false);
});

test("butik adı 2-80 aralığı dışındaysa reddeder", () => {
  assert.equal(validateRegistration({ email: "a@b.co", password: "12345678", shopName: "A" }).ok, false);
  assert.equal(validateRegistration({ email: "a@b.co", password: "12345678", shopName: "x".repeat(81) }).ok, false);
  assert.equal(validateRegistration({ email: "a@b.co", password: "12345678", shopName: "x".repeat(80) }).ok, true);
});

test("eksik/yanlış tipli alanlar reddeder (uydurma veri yok)", () => {
  assert.equal(validateRegistration({}).ok, false);
  assert.equal(validateRegistration({ email: "a@b.co" }).ok, false);
  assert.equal(validateRegistration({ email: "a@b.co", password: 12345678, shopName: "B" }).ok, false);
});

test("slugBase: noktalama küçülür, boşsa 'shop'", () => {
  assert.equal(slugBase("Elegance Bridal!"), "elegance-bridal");
  assert.equal(slugBase("   "), "shop");
  // ASCII-dışı harfler tireye düşer, baştaki/sondaki tireler kırpılır:
  assert.equal(slugBase("Ççek & Gelin"), "ek-gelin");
});

test("pickUniqueSlug: ilk boş adayı verir, çakışmada numaralanır", () => {
  const taken = new Set(["elegance-bridal", "elegance-bridal-2"]);
  assert.equal(pickUniqueSlug("Elegance Bridal", (s) => taken.has(s)), "elegance-bridal-3");
  assert.equal(pickUniqueSlug("Fresh Boutique", (s) => taken.has(s)), "fresh-boutique");
  // hepsi doluysa: 50 turdan sonra zaman damgalı kaçış — mutlaka 'shop-' önekiyle
  const all = (s: string) => /^shop(-\d+)?$/.test(s);
  const fallback = pickUniqueSlug("???", all);
  assert.ok(fallback.startsWith("shop-"), `fallback: ${fallback}`);
});
