import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Bridal Stack — Modern CRM for Bridal Shops",
  description: "Manage appointments, sales, inventory & payments — built for bridal boutiques.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} h-full`}>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1" />
      </head>
      <body className="min-h-full bg-[#fafafa] font-sans antialiased text-[var(--ink)]">{children}</body>
    </html>
  );
}
