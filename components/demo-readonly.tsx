"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Tanıtım kiracısında yazma denemelerini yakalar.
 *
 * NEDEN: ziyaretçi salt okunur bir hesapla geziyor ama ekranda formlar
 * duruyor. "Check back in"e basınca sunucu onu sessizce geri atardı — butikçi
 * ürünü bozuk sanır. Oysa o tık, ilgilendiğini gösteren en güçlü işaret:
 * reddetmek yerine kayıt teklifine çeviriyoruz.
 *
 * Yakalama aşamasında dinliyor, yani formun kendi işleyicisinden ÖNCE.
 * Sunucu tarafındaki rol kapısı yerine geçmez — o kapı yerinde duruyor,
 * bu yalnızca ziyaretçinin gördüğü yüz.
 */
export default function DemoReadOnly() {
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    function onSubmit(e: Event) {
      const form = e.target as HTMLFormElement | null;
      // ⚠️ `form.method` KULLANMA: React'in sunucu-eylemli formları HTML'e
      // method yazmaz, o alan "get" döner ve yazma denemesi süzgeçten kaçar
      // (bir kez kaçtı). Yalnızca AÇIKÇA method="get" yazılmış arama formları
      // serbest; geri kalan her gönderim yazma sayılır.
      if (form?.getAttribute("method")?.toLowerCase() === "get") return;
      e.preventDefault();
      e.stopPropagation();
      setBlocked(document.title.split("—")[0].trim() || "this");
    }
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  if (!blocked) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-readonly-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/40 p-4"
      onClick={() => setBlocked(null)}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="demo-readonly-title" className="text-lg font-bold text-stone-900">
          That works — just not in the demo
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          This sample shop is read-only so every visitor sees it the same way. In your own shop
          that button hands the gown over, books the fitting, or takes the payment.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/signup"
            className="rounded-lg bg-stone-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-stone-800"
          >
            Create my shop — free
          </Link>
          <button
            type="button"
            onClick={() => setBlocked(null)}
            className="rounded-lg px-4 py-2 text-sm text-stone-500 hover:bg-stone-100"
          >
            Keep looking around
          </button>
        </div>
      </div>
    </div>
  );
}
