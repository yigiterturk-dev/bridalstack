"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { STEPS } from "@/lib/demo-tour-steps";

/**
 * Tanıtım turu.
 *
 * NEDEN: kenar çubuğunda 25 başlık var. Kayıtsız gelen butikçi panele düşüp
 * nereye bakacağını bilmiyor; ürünü ayıran üç şeyi (elbisenin yeri, tadilat
 * kuyruğu, prim) kendi bulması gerekiyordu — çoğu bulamadan çıkar. Tur
 * ziyaretçiyi o üç ekrandan geçirip kayıt düğmesine bırakır.
 *
 * Adım sırası ELBİSENİN YOLCULUĞU: rafta → gelinin elinde → temizlemede →
 * tadilatta → parası kimin. Özellik listesi değil, bir hikâye.
 */

const DISMISSED_KEY = "bs-demo-tour-dismissed";

/**
 * Kapatma durumu tarayıcıda tutuluyor, React state'inde değil: aynı sekmede
 * adımdan adıma geçerken sayfa yeniden çiziliyor ve state sıfırlanırdı.
 * Sunucu anlık görüntüsü "kapalı" — ilk çizim sunucuyla birebir aynı olsun,
 * tur yalnızca tarayıcıda belirsin (hydration uyuşmazlığı olmaz).
 */
let memoryDismissed = false;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function readDismissed() {
  if (memoryDismissed) return true;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Gizli sekmede okuma reddedilir; tur yine de görünsün.
    return false;
  }
}

export default function DemoTour() {
  const pathname = usePathname();
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);

  const close = useCallback(() => {
    memoryDismissed = true;
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Yazma reddedilirse tur bu oturumda kapalı kalır, yeter.
    }
    for (const fn of listeners) fn();
  }, []);

  if (dismissed) return null;

  const index = STEPS.findIndex((s) => s.href === pathname);
  // Turun dışındaki bir ekrana giden ziyaretçiyi rahat bırak.
  if (index === -1) return null;

  const step = STEPS[index];
  const next = STEPS[index + 1];
  const isLast = !next;

  return (
    <aside
      aria-label="Guided tour"
      className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_12px_40px_rgba(28,25,23,0.18)]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">
          Step {index + 1} of {STEPS.length}
        </p>
        <button
          type="button"
          onClick={close}
          className="-mt-1 -mr-1 rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          aria-label="Close the tour"
        >
          ✕
        </button>
      </div>

      <h2 className="mt-2 text-base font-serif font-normal text-[var(--ink)]">{step.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{step.body}</p>

      <div className="mt-4 flex items-center gap-3">
        {isLast ? (
          <Link
            href="/signup"
            className="flex-1 rounded-lg bg-stone-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-stone-800"
          >
            Set this up for my shop
          </Link>
        ) : (
          <Link
            href={next.href}
            className="flex-1 rounded-lg bg-stone-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-stone-800"
          >
            Next →
          </Link>
        )}
        <button type="button" onClick={close} className="text-sm text-[var(--muted)] underline hover:text-stone-800">
          {isLast ? "No thanks" : "Explore on my own"}
        </button>
      </div>

      <div className="mt-4 flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <span
            key={s.href}
            className={`h-1 flex-1 rounded-full ${i <= index ? "bg-gold" : "bg-stone-200"}`}
          />
        ))}
      </div>
    </aside>
  );
}
