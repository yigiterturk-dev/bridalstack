import sitemap from "../sitemap";

/*
  llms.txt — AI arama motorları (ChatGPT, Perplexity, Claude, AI Overviews) için
  sitenin ne olduğunu ve sayfaların nerede durduğunu düz metin olarak anlatır.
  Sayfa listesi sitemap'ten üretilir; elle güncellenecek ikinci liste yok.
*/
export const revalidate = 3600;

const BASLIK = "Bridal Stack";
const OZET = "Modern CRM for bridal shops: appointments, sales, inventory and payments in one place, built for bridal boutiques.";
const DETAY = "- Product pages: /landing, /pricing.\n- Guides (/guides/...) explain bridal boutique operations such as alterations, deposits, rentals and stock counts.\n- Policies: /terms, /privacy, /refund.";
const BOLUMLER: Record<string, string> = {"guides": "Guides", "": "Pages"};
const ANA = "Home";

function etiket(url: string): string {
  const yol = new URL(url).pathname.replace(/\/$/, "");
  if (!yol) return ANA;
  const son = decodeURIComponent(yol.split("/").pop() || "");
  const metin = son.replace(/-/g, " ");
  return metin.charAt(0).toLocaleUpperCase("en") + metin.slice(1);
}

export async function GET() {
  const girdiler = await sitemap();
  const gruplar = new Map<string, string[]>();
  for (const g of girdiler) {
    const ilk = new URL(g.url).pathname.split("/").filter(Boolean);
    const anahtar = ilk.length > 1 && BOLUMLER[ilk[0]] ? ilk[0] : ilk.length === 1 && BOLUMLER[ilk[0]] ? ilk[0] : "";
    const ad = BOLUMLER[anahtar] ?? BOLUMLER[""];
    if (!gruplar.has(ad)) gruplar.set(ad, []);
    gruplar.get(ad)!.push(`- [${etiket(g.url)}](${g.url})`);
  }
  const bolumler = [...gruplar.entries()].map(([ad, satirlar]) => `## ${ad}\n\n${satirlar.join("\n")}`);
  const govde = `# ${BASLIK}\n\n> ${OZET}\n\n${DETAY}\n\n${bolumler.join("\n\n")}\n`;
  return new Response(govde, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
