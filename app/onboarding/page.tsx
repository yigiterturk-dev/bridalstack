"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { PRESETS } from "@/config/presets";
import { PACKS, ALL_PACK_IDS, calculateMonthlyPrice, isPackSellable, formatPrice, type PackId } from "@/config/modules";
import { loadDraft, saveDraft, finishOnboarding, type OnboardingDraft } from "./actions";

type ServiceRow = { name: string; duration?: number; price?: number };
type StaffRow = { email: string; role: string };

const STEPS = ["Shop", "Services", "Modules", "Ready"];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [shopName, setShopName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedPacks, setSelectedPacks] = useState<PackId[]>(["base"]);
  const [services, setServices] = useState<ServiceRow[]>([{ name: "" }]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  // Taslağı yükle
  useEffect(() => {
    (async () => {
      try {
        const draft = await loadDraft();
        if (draft) {
          if (draft.shopName) setShopName(draft.shopName);
          if (draft.packs?.length) setSelectedPacks(draft.packs);
          if (draft.services?.length) setServices(draft.services);
          if (draft.staff?.length) setStaff(draft.staff);
          if (draft.step) setStep(Math.min(3, draft.step));
        }
      } catch {
        setError("We could not load your saved progress. You can continue, but keep this tab open while setting up.");
      }
      setHydrated(true);
    })();
  }, []);

  const persist = useCallback(
    (next?: Partial<OnboardingDraft>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          const result = await saveDraft({
            shopName,
            packs: selectedPacks,
            services,
            staff,
            step,
            ...next,
          });
          if (!result.ok) setError("We could not save your progress. Keep this tab open and try again.");
        } catch {
          setError("We could not save your progress. Keep this tab open and try again.");
        }
        setSaving(false);
      }, 600);
    },
    [shopName, selectedPacks, services, staff, step]
  );

  // Değişiklikleri otomatik kaydet (taslak)
  useEffect(() => {
    if (!hydrated) return;
    persist();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [hydrated, shopName, selectedPacks, services, staff, step, persist]);

  function selectPreset(presetId: string) {
    setSelectedPreset(presetId);
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset && presetId !== "custom") {
      setSelectedPacks(preset.packs);
      if (preset.starterServices) {
        setServices(preset.starterServices.map((service) => ({ ...service })));
      }
    }
  }

  function togglePack(packId: PackId) {
    if (packId === "base") return;
    setSelectedPacks((prev) =>
      prev.includes(packId) ? prev.filter((p) => p !== packId) : [...prev, packId]
    );
    setSelectedPreset("custom");
  }

  function updateService(i: number, patch: Partial<ServiceRow>) {
    setServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addServiceRow() {
    setServices((prev) => [...prev, { name: "" }]);
  }
  function removeServiceRow(i: number) {
    setServices((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleFinish() {
    if (!shopName.trim()) {
      setError("Please enter your shop name");
      setStep(1);
      return;
    }
    setLoading(true);
    setError("");
    const cleanServices = services.filter((s) => s.name.trim());
    const res = await finishOnboarding({
      shopName: shopName.trim(),
      packs: selectedPacks,
      services: cleanServices,
      signupSource: typeof document !== "undefined" ? document.referrer || "direct" : "direct",
    });
    if (!res.ok) {
      setError(res.error || "Something went wrong");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  const monthly = calculateMonthlyPrice(selectedPacks);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
            Bridal<span className="text-[var(--accent)]">Stack</span>
          </h1>
          <p className="text-gray-500 mt-2">Let us set up your boutique</p>
          <nav aria-label="Setup progress" className="flex items-center justify-center gap-2 mt-5">
            {STEPS.map((label, idx) => {
              const s = idx + 1;
              return (
                <div key={label} className="flex items-center gap-2" aria-current={s === step ? "step" : undefined}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                        s === step
                          ? "bg-gray-900 text-white"
                          : s < step
                            ? "bg-green-500 text-white"
                            : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {s < step ? "✓" : s}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1">{label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`h-0.5 w-8 ${s < step ? "bg-green-400" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </nav>
          {hydrated && (
            <p className="text-[11px] text-gray-400 mt-3" aria-live="polite">
              {saving ? "Saving draft…" : "Your progress saves automatically"}
            </p>
          )}
        </div>

        {error && (
          <div ref={errorRef} tabIndex={-1} role="alert" aria-live="assertive" className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200 focus:outline-none">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          {/* STEP 1 — Shop name and template */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">What is your boutique called?</h2>
              <label htmlFor="shop-name" className="block text-sm font-medium text-gray-700 mb-2">Boutique name</label>
              <input
                id="shop-name"
                type="text"
                value={shopName}
                onChange={(e) => { setShopName(e.target.value); setError(""); }}
                maxLength={120}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent)] focus-visible:outline-none outline-none text-lg"
                placeholder="e.g. Grace Bridal Boutique"
                autoFocus
              />

              <h3 className="text-sm font-semibold text-gray-900 mt-6 mb-3">Industry template</h3>
              <div className="grid grid-cols-2 gap-3">
                {PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => selectPreset(preset.id)}
                    aria-pressed={selectedPreset === preset.id}
                    className={`text-left p-3 rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 ${
                      selectedPreset === preset.id
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-100 hover:border-gray-300"
                    }`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-xl text-gray-600 mb-1 block">
                      {preset.icon}
                    </span>
                    <div className="font-medium text-gray-900 text-sm">{preset.name}</div>
                  </button>
                ))}
              </div>

              <div className="mt-5 text-sm text-gray-500">
                Monthly total: <strong className="text-gray-900">{formatPrice(monthly)}/mo</strong>
              </div>

              <button
                type="button"
                onClick={() =>
                  shopName.trim() ? setStep(2) : setError("Please enter a name")
                }
                className="mt-6 w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2"
              >
                Continue
              </button>
            </div>
          )}

          {/* STEP 2 — Services */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Add your services</h2>
              <p className="text-sm text-gray-500 mb-6">
                Optional. You can add more of these later.
                {selectedPreset === "bridal" && " We added a few common bridal appointments to get you started."}
              </p>
              <div className="flex flex-col gap-3">
                {services.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={s.name}
                      onChange={(e) => updateService(i, { name: e.target.value })}
                      aria-label={`Service ${i + 1} name`}
                      placeholder="Service name (e.g. Fitting)"
                      maxLength={120}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent)] focus-visible:outline-none"
                    />
                    <input
                      type="number"
                      min={5}
                      value={s.duration ?? ""}
                      onChange={(e) => updateService(i, { duration: Number(e.target.value) })}
                      aria-label={`Service ${i + 1} duration in minutes`}
                      placeholder="min"
                      className="w-20 px-3 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
                    />
                    <input
                      type="number"
                      min={0}
                      value={s.price ?? ""}
                      onChange={(e) => updateService(i, { price: Number(e.target.value) })}
                      aria-label={`Service ${i + 1} price`}
                      placeholder="$"
                      className="w-24 px-3 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
                    />
                    {services.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeServiceRow(i)}
                        className="text-gray-400 hover:text-red-500 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                        aria-label={`Remove service ${i + 1}`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg">close</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addServiceRow}
                className="mt-3 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2"
              >
                + Add service
              </button>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Module selection */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Choose your modules</h2>
              <p className="text-sm text-gray-500 mb-6">
                Turn on the plans you need. Monthly total: <strong>{formatPrice(monthly)}/mo</strong>
              </p>
              {monthly > 0 && (
                <p className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                  Paid modules start with your free trial. You won&apos;t be charged during setup.
                </p>
              )}
              <div className="grid gap-3">
                {ALL_PACK_IDS.map((packId) => {
                  const pack = PACKS[packId];
                  const active = selectedPacks.includes(packId);
                  const sellable = isPackSellable(packId);
                  return (
                    <button
                      type="button"
                      key={packId}
                      onClick={() => togglePack(packId)}
                      disabled={packId === "base" || pack.monthlyPrice === 0 || !sellable}
                      aria-pressed={active}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 ${
                        active ? "border-gray-900 bg-gray-50" : "border-gray-100 hover:border-gray-300"
                      } ${packId === "base" || !sellable ? "opacity-60" : ""}`}
                    >
                      <div>
                        <div className="font-medium text-gray-900">{pack.name}</div>
                        <div className="text-xs text-gray-500">{pack.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {pack.monthlyPrice === 0 ? "Included" : !sellable ? "Coming soon" : `${formatPrice(pack.monthlyPrice)}/mo`}
                        </div>
                        {active && <span className="text-xs text-green-600">✓ Active</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-700">
                  You can invite your team from the <strong>Team</strong> page once setup is done.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — Review and finish */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">You are all set 🎉</h2>
              <p className="text-sm text-gray-500 mb-6">Review your setup and get started.</p>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Shop</dt>
                  <dd className="font-medium text-gray-900">{shopName || "—"}</dd>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Plans</dt>
                  <dd className="font-medium text-gray-900">
                    {selectedPacks.map((p) => PACKS[p]?.name).join(", ")}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Services</dt>
                  <dd className="font-medium text-gray-900">
                    {services.filter((s) => s.name.trim()).length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Monthly total</dt>
                  <dd className="font-medium text-gray-900">{formatPrice(monthly)}/mo</dd>
                </div>
              </dl>

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={loading}
                  aria-busy={loading}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? "Creating…" : "Launch my boutique"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
