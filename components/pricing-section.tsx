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
    <section id="pricing" className="py-32 px-6 bg-stone-900 relative z-10 overflow-hidden text-white rounded-t-[4rem]">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-stone-700 to-transparent" />
      <div className="absolute -top-[50%] left-[50%] -translate-x-1/2 w-[100%] h-[100%] rounded-full bg-rose-500/10 blur-[120px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <Heading className="text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-md">Simple, modular pricing.</Heading>
          <p className="text-stone-400 mt-6 text-xl max-w-2xl mx-auto font-light">
            Every new account opens with a {TRIAL_DAYS}-day trial of all paid modules. When it
            ends nothing is deleted — you drop back to the free plan and pick what you want to keep.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-10 text-sm text-stone-400">
            {[
              "Client portal included, not an add-on",
              "Online booking page included",
              "No setup fee, no contract",
              "Cancel any time",
            ].map((line) => (
              <span key={line} className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-rose-400 text-[18px]">check_circle</span>
                {line}
              </span>
            ))}
          </div>
          {BILLING_CONFIGURED || BILLING_ANNUAL_CONFIGURED ? (
            <p className="text-stone-500 mt-8 text-sm">
              Everything we sell today comes to{" "}
              <strong className="text-white">{formatPrice(calculateMonthlyPrice(SELLABLE_PACK_IDS))}/mo</strong>{" "}
              for your whole shop
              {BILLING_ANNUAL_CONFIGURED ? (
                <>
                  {" "}— or <strong className="text-white">{formatPrice(calculateAnnualPrice(SELLABLE_PACK_IDS))}/yr</strong>{" "}
                  (two months free).
                </>
              ) : (
                "."
              )}
            </p>
          ) : (
            <div className="mt-8 flex flex-col items-center gap-2 text-sm">
              <p className="text-stone-500">
                Every paid module starts with your {TRIAL_DAYS}-day trial. <strong className="text-white">No card required.</strong>
              </p>
              <a
                href="mailto:hello@bridalstack.com?subject=BridalStack%20paid%20plans"
                className="font-semibold text-rose-300 underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-900 rounded"
              >
                Talk to us about paid plans
              </a>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {ALL_PACK_IDS.map((packId) => {
            const pack = PACKS[packId];
            const sellable = pack.monthlyPrice === 0 || isPackSellable(packId);
            const trialOnly = pack.monthlyPrice > 0 && !(BILLING_CONFIGURED || BILLING_ANNUAL_CONFIGURED);
            return (
              <div key={packId} className={`bg-stone-800/50 backdrop-blur-xl rounded-[2.5rem] p-10 transition-all duration-500 hover:-translate-y-2 ${packId === "sales" ? "border border-rose-500/50 shadow-[0_0_50px_-12px_rgba(225,29,72,0.3)] relative" : "border border-stone-700/50"}`}>
                {packId === "sales" && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-rose-400 to-amber-500 text-white px-5 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase shadow-lg">
                    Most Popular
                  </div>
                )}
                {!sellable && (
                  <div className="inline-block mb-4 text-[11px] font-black tracking-widest uppercase text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                    In development
                  </div>
                )}
                <h3 className="text-2xl font-extrabold">{pack.name}</h3>
                <p className="text-[15px] text-stone-400 mt-3 mb-8 h-10 leading-relaxed">{pack.description}</p>
                <div className="mb-10 flex items-baseline gap-1">
                  <span className="text-6xl font-extrabold tracking-tighter">{formatPrice(pack.monthlyPrice)}</span>
                  <span className="text-stone-400 font-medium">/mo</span>
                </div>
                {trialOnly && <p className="-mt-8 mb-8 text-xs font-medium text-amber-300">{TRIAL_DAYS}-day trial included · no card required</p>}
                {!trialOnly && BILLING_ANNUAL_CONFIGURED && pack.monthlyPrice > 0 && (
                  <p className="-mt-8 mb-8 text-xs font-medium text-stone-400">or {formatPrice(annualPrice(pack.monthlyPrice))}/yr · two months free</p>
                )}
                <ul className="space-y-5 mb-12">
                  {pack.modules.map((moduleId) => {
                    const live = isModuleLive(moduleId);
                    return (
                      <li key={moduleId} className={`flex items-start gap-4 text-[15px] font-medium ${live ? "text-stone-300" : "text-stone-500"}`}>
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center mt-0.5 border border-stone-600">
                          <span className={`text-xs font-bold ${live ? "text-rose-400" : "text-stone-500"}`}>{live ? "✓" : "•"}</span>
                        </span>
                        <span>
                          {MODULES[moduleId]?.name}
                          {!live && <span className="ml-2 text-[11px] uppercase tracking-wider text-amber-400/80">soon</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {sellable ? (
                  <Link
                    href="/signup"
                    className={`block text-center py-4 rounded-full text-[15px] font-bold transition-all duration-300 ${
                      packId === "sales"
                        ? "bg-white text-stone-900 hover:bg-stone-200 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-900"
                        : "bg-stone-700/50 text-white hover:bg-stone-700 border border-stone-600/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-900"
                    }`}
                  >
                    {pack.monthlyPrice === 0 ? "Start For Free" : trialOnly ? "Start Free Trial" : "Choose Plan"}
                  </Link>
                ) : (
                  <div className="block text-center py-4 rounded-full text-[15px] font-bold bg-stone-800/60 text-stone-500 border border-stone-700/50 cursor-not-allowed">
                    Not available yet
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
