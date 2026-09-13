"use client";

import { useState } from "react";
import { PACKS, ALL_PACK_IDS, calculateMonthlyPrice, isPackSellable, formatPrice, type PackId } from "@/config/modules";

export function UpgradeButton({ currentPacks }: { currentPacks: PackId[] }) {
  const [selectedPacks, setSelectedPacks] = useState<PackId[]>(currentPacks);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const newPrice = calculateMonthlyPrice(selectedPacks.filter((p) => p !== "base"));
  const currentPrice = calculateMonthlyPrice(currentPacks.filter((p) => p !== "base"));
  const hasChanges = JSON.stringify(selectedPacks.sort()) !== JSON.stringify(currentPacks.sort());

  function togglePack(packId: PackId) {
    if (packId === "base" || !isPackSellable(packId)) return;
    setSelectedPacks((prev) =>
      prev.includes(packId) ? prev.filter((p) => p !== packId) : [...prev, packId]
    );
  }

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packs: selectedPacks }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        <span className="material-symbols-outlined text-lg">upgrade</span>
        Change Plan
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Customize Your Plan</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {ALL_PACK_IDS.map((packId) => {
          const pack = PACKS[packId];
          const active = selectedPacks.includes(packId);
          const sellable = isPackSellable(packId);
          const locked = packId === "base" || !sellable;
          return (
            <button
              key={packId}
              onClick={() => togglePack(packId)}
              disabled={locked}
              title={!sellable && packId !== "base" ? "Not available for purchase yet" : undefined}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                active ? "border-gray-900 bg-gray-50" : "border-gray-100 hover:border-gray-300"
              } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-gray-900">{pack.name}</span>
                {active && packId !== "base" && <span className="text-green-500 text-xs">✓</span>}
              </div>
              <div className="text-xs text-gray-500">
                {packId !== "base" && !sellable
                  ? "Coming soon"
                  : pack.monthlyPrice === 0
                  ? "Free"
                  : `${formatPrice(pack.monthlyPrice)}/mo`}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div>
          <span className="text-sm text-gray-500">New total: </span>
          <span className="text-lg font-bold text-gray-900">{formatPrice(newPrice)}/mo</span>
          {currentPrice !== newPrice && (
            <span className="text-sm text-gray-400 ml-2 line-through">{formatPrice(currentPrice)}/mo</span>
          )}
        </div>
        <button
          onClick={handleCheckout}
          disabled={loading || !hasChanges}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {loading ? "Processing..." : "Update Subscription"}
        </button>
      </div>
    </div>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  async function handlePortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePortal}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-lg">credit_card</span>
      {loading ? "..." : "Manage Billing"}
    </button>
  );
}
