"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Ekleme formu ekranın kalıcı bir sütununu kaplamasın: listenin üstünde tek satırlık
 * "+ başlık" düğmesi, basınca form açılır. Boş ekrandaki "#new" bağlantısı da açar.
 */
export default function AddPanel({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function openIfAsked() {
      if (window.location.hash === "#new" && ref.current) {
        ref.current.open = true;
        ref.current.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }
    openIfAsked();
    window.addEventListener("hashchange", openIfAsked);
    // Aynı hash'e ikinci tıklama hashchange tetiklemez; bağlantıyı doğrudan dinle.
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement).closest?.('a[href="#new"]');
      if (a && ref.current) {
        e.preventDefault();
        ref.current.open = true;
        ref.current.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", openIfAsked);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <details ref={ref} open={defaultOpen} className="group scroll-mt-24 rounded-2xl border border-[var(--line)] bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 font-medium text-[var(--ink)] [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="material-symbols-outlined flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ink)] text-[18px] leading-none text-white">add</span>
        {title}
        <span aria-hidden="true" className="material-symbols-outlined ml-auto text-stone-400 transition-transform group-open:rotate-180">expand_more</span>
      </summary>
      <div className="border-t border-[var(--line)] px-4 py-5">
        <div className="max-w-xl">{children}</div>
      </div>
    </details>
  );
}
