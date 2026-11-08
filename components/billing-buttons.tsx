"use client";

import { useState } from "react";
import {
  PACKS,
  ALL_PACK_IDS,
  SELLABLE_PACK_IDS,
  calculateMonthlyPrice,
  calculateAnnualPrice,
  annualPrice,
  isPackSellable,
  formatPrice,
  type PackId,
} from "@/config/modules";

type Interval = "monthly" | "annual";

export function UpgradeButton({
  currentPacks,
  currentInterval,
  billingConfigured,
  billingAnnualConfigured = false,
}: {
  currentPacks: PackId[];
  currentInterval?: "monthly" | "annual";
  billingConfigured: boolean;
  billingAnnualConfigured?: boolean;
}) {
  const [selectedPacks, setSelectedPacks] = useState<PackId[]>(currentPacks);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<Interval>(
    currentInterval ?? (billingConfigured ? "monthly" : "annual")
  );

  const paidSelected = selectedPacks.filter((p) => p !== "base");
  const newMonthly = calculateMonthlyPrice(paidSelected);
  const newAnnual = calculateAnnualPrice(paidSelected);
  const currentMonthly = calculateMonthlyPrice(currentPacks.filter((p) => p !== "base"));
  const allMonthly = calculateMonthlyPrice(SELLABLE_PACK_IDS);
  const allAnnual = calculateAnnualPrice(SELLABLE_PACK_IDS);
  const allSelected = SELLABLE_PACK_IDS.every((p) => selectedPacks.includes(p));
  const packsChanged = JSON.stringify([...selectedPacks].sort()) !== JSON.stringify([...currentPacks].sort());
  // Aralık tek başına da bir değişikliktir: mevcut ücretli paket varsa
  // aylık → yıllık geçişi checkout'u tetiklemeli.
  const intervalChanged = paidSelected.length > 0 && Boolean(currentInterval) && billingInterval !== currentInterval;
  const hasChanges = packsChanged || intervalChanged;

  function togglePack(packId: PackId) {
    if (packId === "base" || !isPackSellable(packId)) return;
    setSelectedPacks((prev) =>
      prev.includes(packId) ? prev.filter((p) => p !== packId) : [...prev, packId]
    );
  }

  function selectAllModules() {
    setSelectedPacks((prev) => Array.from(new Set([...prev, ...SELLABLE_PACK_IDS])));
  }

  function clearPaidModules() {
    setSelectedPacks((prev) => prev.filter((p) => !SELLABLE_PACK_IDS.includes(p)));
  }

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packs: selectedPacks, interval: billingInterval }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || "We couldn't start checkout. Please try again.");
    } catch {
      setError("We couldn't start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Ne aylık ne yıllık hat yapılandırılmamışsa kullanıcıyı ölü bir 503'e
  // göndermek yerine durumu baştan söylüyoruz: deneme süreci yine çalışır.
  if (!billingConfigured && !billingAnnualConfigured) {
    return (
      <div className="flex flex-col items-start gap-1.5 max-w-xs">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium cursor-not-allowed"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-lg">hourglass_top</span>
          Paid plans coming soon
        </button>
        <p className="text-xs text-gray-500" role="status">
          Paid checkout is being connected. Your current plan and any active trial continue to work.
        </p>
        <a
          href="mailto:hello@bridalstack.com?subject=BridalStack%20paid%20plans"
          className="text-xs font-semibold text-gray-700 underline underline-offset-2 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 rounded"
        >
          Talk to us about paid plans
        </a>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="plan-selector"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
      >
        <span className="material-symbols-outlined text-lg">upgrade</span>
        Change Plan
      </button>
    );
  }

  const totalLabel =
    billingInterval === "annual"
      ? `${formatPrice(newAnnual)}/yr · ${formatPrice(Math.round(newAnnual / 12))}/mo`
      : `${formatPrice(newMonthly)}/mo`;

  return (
    <div id="plan-selector" className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Customize Your Plan</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close plan selector" className="text-gray-400 hover:text-gray-600 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2">
          <span aria-hidden="true" className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Aylık / yıllık aralık. Yıllıkta 12 ayın bedeli 10 ay. */}
      <div className="mb-4 inline-flex rounded-xl border border-gray-200 p-1 bg-gray-50" role="group" aria-label="Billing interval">
        <button
          type="button"
          onClick={() => setBillingInterval("monthly")}
          disabled={!billingConfigured}
          aria-pressed={billingInterval === "monthly"}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${billingInterval === "monthly" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"} disabled:opacity-40`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setBillingInterval("annual")}
          disabled={!billingAnnualConfigured}
          aria-pressed={billingInterval === "annual"}
          title={!billingAnnualConfigured ? "Annual billing is not configured yet" : undefined}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${billingInterval === "annual" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"} disabled:opacity-40`}
        >
          Annual · 2 months free
        </button>
      </div>

      {/* Hepsi dahil: tek tıkla tüm satılabilir modüller. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold/30 bg-gold-soft px-4 py-3">
        <div className="text-xs text-gold">
          <strong className="font-semibold">All modules</strong> — {formatPrice(allMonthly)}/mo ·{" "}
          {formatPrice(allAnnual)}/yr (save {formatPrice(allMonthly * 12 - allAnnual)})
        </div>
        <button
          type="button"
          onClick={allSelected ? clearPaidModules : selectAllModules}
          className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-white hover:bg-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2"
        >
          {allSelected ? "Clear paid modules" : "Select all modules"}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {ALL_PACK_IDS.map((packId) => {
          const pack = PACKS[packId];
          const active = selectedPacks.includes(packId);
          const sellable = isPackSellable(packId);
          const locked = packId === "base" || pack.monthlyPrice === 0 || !sellable;
          const priceLabel =
            pack.monthlyPrice === 0
              ? "Included"
              : !sellable
              ? "Coming soon"
              : billingInterval === "annual"
              ? `${formatPrice(annualPrice(pack.monthlyPrice))}/yr`
              : `${formatPrice(pack.monthlyPrice)}/mo`;
          return (
            <button
              key={packId}
              type="button"
              onClick={() => togglePack(packId)}
              disabled={locked}
              title={!sellable && pack.monthlyPrice > 0 ? "Not available for purchase yet" : undefined}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                active ? "border-gray-900 bg-gray-50" : "border-gray-100 hover:border-gray-300"
              } ${locked ? "opacity-60 cursor-not-allowed" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-gray-900">{pack.name}</span>
                {active && packId !== "base" && <span className="text-green-500 text-xs">✓</span>}
              </div>
              <div className="text-xs text-gray-500">{priceLabel}</div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div>
          <span className="text-sm text-gray-500">New total: </span>
          <span className="text-lg font-bold text-gray-900">{totalLabel}</span>
          {billingInterval === "monthly" && currentMonthly !== newMonthly && (
            <span className="text-sm text-gray-400 ml-2 line-through">{formatPrice(currentMonthly)}/mo</span>
          )}
          {billingInterval === "annual" && newMonthly > 0 && (
            <span className="ml-2 text-xs text-green-700">save {formatPrice(newMonthly * 12 - newAnnual)}/yr</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading || !hasChanges}
          aria-busy={loading}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
        >
          {loading ? "Processing..." : "Update Subscription"}
        </button>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || "We couldn't open billing. Please try again.");
    } catch {
      setError("We couldn't open billing. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handlePortal}
        disabled={loading}
        aria-busy={loading}
        className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
      >
        <span className="material-symbols-outlined text-lg">credit_card</span>
        {loading ? "Opening..." : "Manage Billing"}
      </button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
