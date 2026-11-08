import Link from "next/link";
import { PACKS, ALL_PACK_IDS, SELLABLE_PACK_IDS, MODULES, calculateMonthlyPrice, calculateAnnualPrice, annualPrice, isPackSellable, isModuleLive, formatPrice } from "@/config/modules";
import { TRIAL_DAYS } from "@/lib/trial";
import { BILLING_CONFIGURED, BILLING_ANNUAL_CONFIGURED } from "@/lib/dodo";

/**
 * Fiyat tablosu — landing'deki #pricing ile /pricing aynı kaynaktan okusun,
 * iki yerde iki farklı rakam yazılmasın. /pricing'de başlık h1 olur.
 */
export default function PricingSection({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  const Heading = headingLevel;
  return (
    <section id="pricing" className="scroll-mt-20 border-t border-[var(--line)] bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Heading className="font-serif text-4xl font-normal text-[var(--ink)] md:text-5xl">Every price, on the page.</Heading>
          <p className="mt-4 text-lg text-[var(--muted)]">
            Every new shop gets {TRIAL_DAYS} days of every paid module. When it ends nothing is deleted:
            you drop to the free plan and keep what you pay for.
          </p>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--muted)]">
            {["Client portal included", "Online booking page included", "No setup fee, no contract", "Cancel any time"].map((line) => (
              <li key={line} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-gold">check</span>
                {line}
              </li>
            ))}
          </ul>
          {BILLING_CONFIGURED || BILLING_ANNUAL_CONFIGURED ? (
            <p className="mt-6 text-sm text-[var(--muted)]">
              Everything we sell today comes to{" "}
              <strong className="text-[var(--ink)]">{formatPrice(calculateMonthlyPrice(SELLABLE_PACK_IDS))}/mo</strong> for your whole shop
              {BILLING_ANNUAL_CONFIGURED ? (
                <>
                  , or <strong className="text-[var(--ink)]">{formatPrice(calculateAnnualPrice(SELLABLE_PACK_IDS))}/yr</strong> (two months free).
                </>
              ) : (
                "."
              )}
            </p>
          ) : (
            <p className="mt-6 text-sm text-[var(--muted)]">
              No card required.{" "}
              <a href="mailto:hello@bridalstack.com?subject=BridalStack%20paid%20plans" className="font-medium text-[var(--ink)] underline underline-offset-4 hover:text-gold">
                Talk to us about paid plans
              </a>
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ALL_PACK_IDS.map((packId) => {
            const pack = PACKS[packId];
            const sellable = pack.monthlyPrice === 0 || isPackSellable(packId);
            const trialOnly = pack.monthlyPrice > 0 && !(BILLING_CONFIGURED || BILLING_ANNUAL_CONFIGURED);
            const featured = packId === "sales";
            return (
              <div key={packId} className={`relative flex flex-col rounded-2xl border bg-white p-7 ${featured ? "border-gold shadow-[0_8px_30px_-12px_rgba(168,135,90,0.35)]" : "border-[var(--line)]"}`}>
                {featured && (
                  <span className="absolute -top-3 left-7 rounded-full bg-gold px-3 py-1 text-xs font-medium text-white">Recommended</span>
                )}
                {!sellable && (
                  <span className="mb-3 inline-block self-start rounded-full bg-amber-soft px-2.5 py-1 text-xs font-medium text-amber">In development</span>
                )}
                <h3 className="font-serif text-2xl text-[var(--ink)]">{pack.name}</h3>
                <p className="mt-1.5 min-h-10 text-sm text-[var(--muted)]">{pack.description}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-serif text-5xl tabular-nums text-[var(--ink)]">{formatPrice(pack.monthlyPrice)}</span>
                  <span className="text-[var(--muted)]">/mo</span>
                </div>
                {trialOnly && <p className="mt-1 text-xs text-[var(--muted)]">{TRIAL_DAYS}-day trial included · no card</p>}
                {!trialOnly && BILLING_ANNUAL_CONFIGURED && pack.monthlyPrice > 0 && (
                  <p className="mt-1 text-xs text-[var(--muted)]">or {formatPrice(annualPrice(pack.monthlyPrice))}/yr · two months free</p>
                )}
                <ul className="mb-7 mt-6 flex-1 space-y-2.5">
                  {pack.modules.map((moduleId) => {
                    const live = isModuleLive(moduleId);
                    return (
                      <li key={moduleId} className={`flex items-start gap-2 text-sm ${live ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                        <span aria-hidden="true" className={`material-symbols-outlined mt-px text-[18px] ${live ? "text-gold" : "text-stone-300"}`}>{live ? "check" : "schedule"}</span>
                        <span>
                          {MODULES[moduleId]?.name}
                          {!live && <span className="ml-1.5 text-xs text-[var(--muted)]">soon</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {sellable ? (
                  <Link
                    href="/signup"
                    className={`block rounded-xl py-3 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 ${
                      featured ? "bg-[var(--ink)] text-white hover:bg-stone-800" : "border border-[var(--line)] text-[var(--ink)] hover:border-stone-300"
                    }`}
                  >
                    {pack.monthlyPrice === 0 ? "Start for free" : trialOnly ? "Start free trial" : "Choose plan"}
                  </Link>
                ) : (
                  <div className="block cursor-not-allowed rounded-xl border border-[var(--line)] py-3 text-center text-sm font-medium text-[var(--muted)]">Not available yet</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
