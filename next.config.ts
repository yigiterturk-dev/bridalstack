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
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
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
