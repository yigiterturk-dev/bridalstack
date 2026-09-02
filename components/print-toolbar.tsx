"use client";

import Link from "next/link";

/** Yazdırma düğmesi ve geri dönüş bağlantısı — çıktıda görünmez. */
export default function PrintToolbar({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="no-print max-w-[820px] mx-auto mb-6 flex items-center justify-between gap-4">
      <Link href={backHref} className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
        ← {backLabel}
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="px-5 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors inline-flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">print</span>
        Print or save as PDF
      </button>
    </div>
  );
}
