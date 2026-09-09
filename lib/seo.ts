import type { Metadata } from "next";

export const SITE_NAME = "Bridal Stack";

/**
 * Aranabilir sayfaların adres ve etiket kuralları.
 *
 * Tek yerden okunur: canonical adresi elle yazan her sayfa, er geç sorgu
 * dizeli veya sondaki eğik çizgili bir ikizini indekse sokar.
 */
export function absoluteUrl(base: string, path: string): string {
  const root = base.replace(/\/+$/, "");
  const rel = path.replace(/^\/+/, "");
  return rel ? `${root}/${rel}` : root;
}

/** Canonical: sorgu dizesi ve sondaki eğik çizgi olmadan. */
export function canonical(base: string, path: string): string {
  const clean = path.split("?")[0].split("#")[0].replace(/\/+$/, "");
  return absoluteUrl(base, clean);
}

export type PageSeo = {
  base: string;
  path: string;
  title: string;
  description: string;
  /** Yazı ise yayın tarihi — OpenGraph tipi "article" olur. */
  publishedAt?: string;
};

export function siteMetadata({ base, path, title, description, publishedAt }: PageSeo): Metadata {
  const url = canonical(base, path);
  // Marka adı başlıkta iki kez geçmesin: ana sayfanın başlığı zaten marka.
  const fullTitle = title === SITE_NAME ? title : `${title} — ${SITE_NAME}`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: publishedAt ? "article" : "website",
      url,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      ...(publishedAt ? { publishedTime: publishedAt } : {}),
    },
    twitter: { card: "summary_large_image", title: fullTitle, description },
  };
}

/** Oturum arkasındaki uygulama sayfaları indekslenmez. */
export const NO_INDEX: Metadata = { robots: { index: false, follow: false } };

/**
 * Aranan sayfaların taban adresi. Sitemap ve canonical bunu kullanır; istek
 * başlığından türetilirse önizleme adresleri indekse sızar, o yüzden yalnız
 * env veya sabit alan adı.
 */
export function siteBase(): string {
  return (process.env.NEXTAUTH_URL || "https://bridalstack.com").replace(/\/+$/, "");
}
