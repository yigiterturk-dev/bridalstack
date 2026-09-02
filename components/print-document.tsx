import type { ReactNode } from "react";

/**
 * A4 için yazdırılabilir belge kabuğu.
 *
 * PDF üretmek için ayrı bir kütüphane kullanmıyoruz: tarayıcının kendi
 * "yazdır / PDF olarak kaydet" akışı her platformda çalışıyor, yazı tiplerini
 * doğru gömüyor ve sunucuya yük bindirmiyor. Ekranda gri zeminde bir sayfa
 * görünür; yazdırırken kenar çubuğu, düğmeler ve gölgeler kaybolur.
 */
export default function PrintDocument({
  shopName,
  logoUrl,
  accentColor,
  documentTitle,
  reference,
  children,
  footer,
}: {
  shopName: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  documentTitle: string;
  reference?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const accent = accentColor ?? "#b4496a";

  return (
    <div className="print-sheet bg-white text-stone-900 mx-auto w-full max-w-[820px] p-10 sm:p-14 rounded-2xl border border-stone-200 shadow-sm">
      <header className="flex items-start justify-between gap-8 pb-6 border-b" style={{ borderColor: accent + "33" }}>
        <div className="min-w-0">
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoUrl} alt={shopName} className="h-12 mb-3 object-contain" />
          ) : (
            <div className="text-xl font-extrabold tracking-tight mb-1" style={{ color: accent }}>
              {shopName}
            </div>
          )}
          {logoUrl && <div className="text-sm font-semibold text-stone-700">{shopName}</div>}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400">
            {documentTitle}
          </div>
          {reference && <div className="font-mono text-sm font-bold mt-1">{reference}</div>}
        </div>
      </header>

      <div className="py-8">{children}</div>

      {footer && (
        <footer className="pt-6 border-t border-stone-200 text-xs text-stone-400 leading-relaxed">
          {footer}
        </footer>
      )}
    </div>
  );
}
