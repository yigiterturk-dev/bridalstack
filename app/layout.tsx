import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bridal Stack — Modern CRM for Bridal Shops",
  description: "Manage appointments, sales, inventory & payments — built for bridal boutiques.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <head>
        {/* Material Symbols is an icon stylesheet; next/font does not support it. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1&display=optional" />
      </head>
      <body className="min-h-full bg-[#fafafa] font-sans antialiased text-[var(--ink)]">{children}</body>
    </html>
  );
}
