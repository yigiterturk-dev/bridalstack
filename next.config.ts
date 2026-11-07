import type { NextConfig } from "next";

// Güvenlik başlıkları — tüm rotalara uygulanır. Clickjacking, MIME-sniffing,
// referrer sızıntısı ve tarayıcı özelliklerine karşı temel sertleştirme.
// NOT: camera=(self) — html5-qrcode (QR tarama) kamera erişimine ihtiyaç duyar.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // CSP — script-src'de 'unsafe-inline'/'unsafe-eval' Next.js'in kendi satır içi
    // önyükleme betikleri için duruyor; nonce'a geçmek proxy katmanı ister. Yine de
    // asıl kazanç burada: harici betik kaynağı, eklenti (object), taban URL ve form
    // hedefi kilitli — yani XSS bulunsa bile veriyi dışarı taşıyacak yol dar.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      // Yüklenen fotoğraflar Vercel Blob'dan doğrudan gelir (next/image unoptimized).
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://www.transparenttextures.com",
      "connect-src 'self' https://*.public.blob.vercel-storage.com https://blob.vercel-storage.com",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // Framework parmak izini başlıktan kaldır (X-Powered-By).
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  // netcup'ta docker ile çalışır
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
