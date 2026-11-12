import { BrandMark } from "@/components/brand-mark";
import Link from "next/link";
import PricingSection from "@/components/pricing-section";
import { TRIAL_DAYS } from "@/lib/trial";
import { formatPrice } from "@/config/modules";
import type { Metadata } from "next";
import { siteBase, siteMetadata } from "@/lib/seo";

// Ödeme hattı env'den okunur; Docker build'inde env yok → statik üretimde
// "ödeme kapalı" sürümü donardı. İstek anında render et.
export const dynamic = "force-dynamic";

export const metadata: Metadata = siteMetadata({
  base: siteBase(),
  path: "/landing",
  title: "Bridal Stack",
  description:
    "CRM for bridal boutiques: brides, fittings, orders, payments and stock in one place. Free plan, no card, every price on the page.",
});

const NAV_LINK = "text-sm text-[var(--muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 rounded";
const BTN_DARK = "inline-flex items-center justify-center rounded-xl bg-[var(--ink)] px-6 py-3 text-base font-medium text-white transition-colors hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2";
const BTN_LIGHT = "inline-flex items-center justify-center rounded-xl border border-[var(--line)] bg-white px-6 py-3 text-base font-medium text-[var(--ink)] transition-colors hover:border-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2";

/** Ürünün kendi Today satırının statik kopyası — "böyle görünüyor" demek için. Adlar örnek. */
const SAMPLE = [
  { name: "Ava", reason: "Hem alteration is 2 days late", steps: [1, 1, 1, 2, 0], days: "38 days", dot: "bg-late" },
  { name: "Elena", reason: "Dress hasn't arrived yet", steps: [1, 3, 0, 0, 0], days: "21 days", dot: "bg-amber" },
  { name: "Sofia", reason: "Final fitting booked", steps: [1, 1, 1, 1, 0], days: "74 days", dot: "bg-gold" },
];
const STEP = ["bg-stone-200", "bg-gold", "bg-late", "bg-amber"];

const JOURNEY = [
  { title: "Dress chosen", text: "She said yes. The order and her deposit go on her page." },
  { title: "Dress arrived", text: "You see which dresses are still with the maker, and how long until her wedding." },
  { title: "Fittings", text: "Every fitting and alteration, with the date you promised it." },
  { title: "Final fitting", text: "Booked in time, or flagged in red if it is getting close." },
  { title: "Picked up", text: "Paid in full and out the door. She drops off the list." },
];

const FEATURES = [
  { icon: "event", title: "Appointments", text: "A day-by-day list. One tap to confirm, one to mark it done." },
  { icon: "receipt_long", title: "Orders and contracts", text: "Write the order, send a signing link, keep the signed copy on the order." },
  { icon: "payments", title: "Payments", text: "Deposits, payment plans and who is late, without a spreadsheet." },
  { icon: "checkroom", title: "Stock", text: "What is on the racks and what is running low. Barcode scanning works." },
  { icon: "calendar_month", title: "Online booking", text: "A booking page brides use themselves. It is included, not an add-on." },
  { icon: "tune", title: "Your menu, your way", text: "Put the screens you use every day in the menu. Hide the rest." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-[var(--ink)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-[var(--ink)] focus:px-5 focus:py-3 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <nav aria-label="Primary navigation" className="sticky top-0 z-50 border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" aria-label="BridalStack home" className="inline-flex items-center gap-2 text-xl font-extrabold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 rounded">
            <BrandMark className="h-8 w-8 shrink-0" />
            <span>Bridal<span className="text-gold">Stack</span></span>
          </Link>
          <div className="flex items-center gap-5 sm:gap-7">
            <a href="#pricing" className={`${NAV_LINK} hidden sm:inline`}>Pricing</a>
            <Link href="/guides" className={`${NAV_LINK} hidden sm:inline`}>Guides</Link>
            <Link href="/login" className={NAV_LINK}>Sign in</Link>
            <Link href="/signup" className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <main id="main-content">
        <section className="px-5 pb-20 pt-16 lg:pt-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-sm font-medium text-gold">For bridal boutiques</p>
              <h1 className="mt-3 font-serif text-5xl font-normal leading-[1.05] tracking-tight lg:text-6xl">
                Know which bride needs you today.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
                Every bride&apos;s wedding date, dress, fittings and payments on one screen.
                Anything running late turns red before it becomes a problem.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className={BTN_DARK}>Start free</Link>
                {/* Kayıt duvarına çarpmadan ürünü gören kişi geri dönüyor — ikincil CTA canlı demo. */}
                <Link href="/demo" className={BTN_LIGHT}>Look around a sample shop</Link>
              </div>
              <p className="mt-5 text-sm text-[var(--muted)]">
                {TRIAL_DAYS}-day trial of everything · free plan after that · no card · the sample shop needs no sign-up
              </p>
            </div>

            <div aria-label="What the Today screen looks like" className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[0_20px_50px_-25px_rgba(28,26,35,0.25)]">
              <p className="text-xs text-[var(--muted)]">Saturday</p>
              <p className="font-serif text-2xl">Good morning</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[["Fittings today", "3"], ["Late", "1"], ["Due this week", formatPrice(1250)]].map(([label, value], i) => (
                  <div key={label} className="rounded-xl border border-[var(--line)] p-3">
                    <div className="text-[11px] text-[var(--muted)]">{label}</div>
                    <div className={`font-serif text-xl tabular-nums ${i === 1 ? "text-late" : ""}`}>{value}</div>
                  </div>
                ))}
              </div>
              <p className="mt-5 font-serif text-base">Needs attention</p>
              <div className="mt-2 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
                {SAMPLE.map((b) => (
                  <div key={b.name} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${b.dot}`} />
                        {b.name}
                      </div>
                      <p className="truncate text-xs text-[var(--muted)]">{b.reason}</p>
                    </div>
                    <div aria-hidden="true" className="hidden gap-1 sm:flex">
                      {b.steps.map((s, i) => <span key={i} className={`h-1.5 w-5 rounded-full ${STEP[s]}`} />)}
                    </div>
                    <span className="w-16 text-right font-serif text-sm tabular-nums">{b.days}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-[var(--muted)]">Sample brides. This is the real screen.</p>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--line)] bg-gold-soft/40 px-5 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="max-w-2xl font-serif text-4xl font-normal">Five steps from &ldquo;yes&rdquo; to the wedding.</h2>
            <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
              Every bride moves through the same five steps. BridalStack works out where she is from what you already record, and tells you when she falls behind.
            </p>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {JOURNEY.map((j, i) => (
                <li key={j.title} className="rounded-2xl border border-[var(--line)] bg-white p-5">
                  <span className="font-serif text-2xl text-gold tabular-nums">{i + 1}</span>
                  <h3 className="mt-1 font-medium">{j.title}</h3>
                  <p className="mt-1.5 text-sm text-[var(--muted)]">{j.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 px-5 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="max-w-2xl font-serif text-4xl font-normal">The rest of the shop, in the same place.</h2>
            <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <span aria-hidden="true" className="material-symbols-outlined flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-[22px] text-gold">{f.icon}</span>
                  <div>
                    <h3 className="font-medium">{f.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{f.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <PricingSection />

        <section className="border-t border-[var(--line)] px-5 py-20 text-center">
          <h2 className="font-serif text-4xl font-normal">Open the sample shop. No sign-up.</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-[var(--muted)]">Click around with made-up brides. If it fits how you work, start your own in a few minutes.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/demo" className={BTN_DARK}>Look around</Link>
            <Link href="/signup" className={BTN_LIGHT}>Start free</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <p className="text-sm text-[var(--muted)]">
            <span className="font-extrabold text-[var(--ink)]">Bridal<span className="text-gold">Stack</span></span> · © {new Date().getFullYear()}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[["/guides", "Guides"], ["/pricing", "Pricing"], ["/refund", "Refunds"], ["/privacy", "Privacy"], ["/terms", "Terms"]].map(([href, label]) => (
              <Link key={href} href={href} className={NAV_LINK}>{label}</Link>
            ))}
            <a href="mailto:hello@bridalstack.com" className={NAV_LINK}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
