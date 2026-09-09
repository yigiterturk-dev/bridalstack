import { ImageResponse } from "next/og";

export const alt = "Bridal Stack — CRM for bridal boutiques";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Paylaşım görseli kodla üretilir: ayrı bir PNG dosyası tutulursa metin
 * değiştiğinde güncellenmeyi unutuluyor ve görselle sayfa ayrışıyor.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #FDFCFB 0%, #F7EDEF 100%)",
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: 8, color: "#A8A29E", textTransform: "uppercase" }}>
          Bridal Stack
        </div>
        <div style={{ fontSize: 78, fontWeight: 800, color: "#1C1917", lineHeight: 1.1, marginTop: 28 }}>
          The bridal boutique,
        </div>
        <div style={{ fontSize: 78, fontWeight: 800, color: "#9F1239", lineHeight: 1.1 }}>
          run from one screen.
        </div>
        <div style={{ fontSize: 34, color: "#57534E", marginTop: 36 }}>
          Brides · fittings · orders · payments · stock
        </div>
      </div>
    ),
    size
  );
}
