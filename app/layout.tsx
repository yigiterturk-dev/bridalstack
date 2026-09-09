import type { Metadata } from "next";
import "./globals.css";
import { siteBase, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  // Göreli OpenGraph/canonical adreslerinin çözüleceği taban.
  metadataBase: new URL(siteBase()),
  // Şablon (`%s — marka`) YOK: sayfa başlıklarını `siteMetadata` zaten marka
  // ile bitiriyor, ikisi birleşince ad iki kez yazılırdı.
  title: "Bridal Stack — Modern CRM for Bridal Shops",
  description: "Manage appointments, sales, inventory & payments — built for bridal boutiques.",
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Material Symbols is an icon stylesheet; next/font does not support it. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1&display=optional" />
      </head>
      <body className="min-h-full bg-[#fafafa] font-sans antialiased text-[var(--ink)]">{children}</body>
    </html>
  );
}
