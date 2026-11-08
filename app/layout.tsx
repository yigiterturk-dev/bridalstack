import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
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
  appleWebApp: { capable: true, title: "Bridal Stack", statusBarStyle: "default" },
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const viewport: Viewport = {
  themeColor: "#7f1d1d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${fraunces.variable}`}>
      <head>
        <link rel="preload" href="/fonts/material-symbols-outlined.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full bg-[var(--bg)] font-sans antialiased text-[var(--ink)]">{children}</body>
    </html>
  );
}
