import type { MetadataRoute } from "next";
import { siteBase } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = siteBase();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Oturum arkasındaki uygulama ve herkese açık ama tekil bağlantılar
        // (portal, sözleşme, davet) taranmamalı: içerik değiller ve jeton taşırlar.
        disallow: ["/api/", "/dashboard", "/settings", "/portal/", "/contracts/", "/invite/", "/onboarding"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
