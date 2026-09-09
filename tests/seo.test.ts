import { test } from "node:test";
import assert from "node:assert/strict";
import { absoluteUrl, canonical, siteMetadata, SITE_NAME } from "../lib/seo.ts";
import { GUIDES, guideBySlug } from "../content/guides.ts";

const base = "https://bridalstack.com";

test("mutlak adres tek eğik çizgiyle kurulur", () => {
  assert.equal(absoluteUrl(base, "/guides"), "https://bridalstack.com/guides");
  assert.equal(absoluteUrl(base + "/", "guides"), "https://bridalstack.com/guides");
  assert.equal(absoluteUrl(base, "/"), "https://bridalstack.com");
});

test("canonical sorgu dizesini ve sondaki eğik çizgiyi atar", () => {
  assert.equal(canonical(base, "/guides/?utm_source=x"), "https://bridalstack.com/guides");
  assert.equal(canonical(base, "/"), "https://bridalstack.com");
});

test("sayfa başlığı marka adını bir kez taşır", () => {
  const meta = siteMetadata({ base, path: "/guides", title: "Guides", description: "d" });
  assert.equal(meta.title, `Guides — ${SITE_NAME}`);
  const home = siteMetadata({ base, path: "/", title: SITE_NAME, description: "d" });
  assert.equal(home.title, SITE_NAME);
});

test("her sayfa canonical ve OpenGraph taşır", () => {
  const meta = siteMetadata({ base, path: "/guides", title: "Guides", description: "d" });
  assert.equal(meta.alternates?.canonical, "https://bridalstack.com/guides");
  assert.equal(meta.openGraph?.url, "https://bridalstack.com/guides");
  assert.equal((meta.openGraph as { type?: string })?.type, "website");
});

test("rehber slug'ları benzersiz ve adres uyumlu", () => {
  const slugs = GUIDES.map((g) => g.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test("her rehberin özgün metni var — şablon sayfa taranmaz", () => {
  for (const g of GUIDES) {
    const words = g.sections.reduce((t, s) => t + s.body.join(" ").split(/\s+/).length, 0);
    assert.ok(words >= 300, `${g.slug} çok kısa: ${words} kelime`);
    assert.ok(g.description.length >= 50 && g.description.length <= 165, `${g.slug} açıklaması uygun değil`);
    assert.ok(g.sections.length >= 3, `${g.slug} bölüm sayısı az`);
  }
});

test("rehber açıklamaları birbirinin kopyası değil", () => {
  const d = GUIDES.map((g) => g.description);
  assert.equal(new Set(d).size, d.length);
});

test("slug ile rehber bulunur, bilinmeyen slug null döner", () => {
  assert.equal(guideBySlug(GUIDES[0].slug)?.title, GUIDES[0].title);
  assert.equal(guideBySlug("yok-boyle-bir-sey"), null);
});
