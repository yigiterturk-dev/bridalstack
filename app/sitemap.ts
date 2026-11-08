import type { MetadataRoute } from "next";
import { siteBase, absoluteUrl } from "@/lib/seo";
import { GUIDES } from "@/content/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteBase();
  const now = new Date();

  return [
    // `/` 307 ile `/landing`'e gidiyor; indekse giren adres o, kök değil.
    { url: absoluteUrl(base, "/landing"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl(base, "/guides"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl(base, "/signup"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // Kayıtsız girilen canlı tanıtım — outreach mesajlarının gittiği adres.
    { url: absoluteUrl(base, "/demo"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl(base, "/pricing"), lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl(base, "/refund"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl(base, "/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl(base, "/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    ...GUIDES.map((g) => ({
      url: absoluteUrl(base, `/guides/${g.slug}`),
      lastModified: new Date(g.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
