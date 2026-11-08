import PageHead from "@/components/page-head";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember } from "@/lib/tenant";
import { PACKS, MODULES, ALL_PACK_IDS, calculateMonthlyPrice, annualPrice, isPackSellable, isModuleLive, formatPrice } from "@/config/modules";
import { hasPermission, ROLE_LABELS, normalizeRole } from "@/lib/rbac";
import { UpgradeButton, ManageBillingButton } from "@/components/billing-buttons";
import { BILLING_CONFIGURED, BILLING_ANNUAL_CONFIGURED } from "@/lib/dodo";
import { currentBillingInterval, readDodoState } from "@/lib/dodo-state";
import SignOutButton from "@/components/sign-out-button";
import CopyField from "@/components/copy-field";
import SubmitButton from "@/components/submit-button";
import SubscriptionRefresher from "@/components/subscription-refresher";
import { updateShopProfile, startPackTrial, seedDemoData, clearDemoData, deleteAccount } from "./actions";
import { canStartTrial, TRIAL_DAYS } from "@/lib/trial";
import { normalizeTimeZone, TIME_ZONE_OPTIONS } from "@/lib/timezone";

type Props = { searchParams?: Promise<{ success?: string; error?: string }> };

const ERRORS: Record<string, string> = {
  forbidden: "You do not have permission to change these settings.",
  name_required: "Shop name cannot be empty.",
  slug_invalid: "The booking address may only contain lowercase letters, numbers and hyphens.",
  slug_taken: "That booking address is already in use. Try another one.",
  logo_invalid: "The logo address must start with http:// or https://.",
  color_invalid: "Colors must be six-digit hex values, for example #B4496A.",
  timezone_invalid: "Choose a valid shop time zone.",
  update_failed: "Could not save your changes. Please try again.",
  trial_unavailable: "That free trial is not available for this workspace.",
  confirm_mismatch: "Type your booking address exactly to confirm.",
  password_wrong: "That password is incorrect.",
};

/** Herkese açık randevu adresini oluşturmak için isteğin kendi kökeni. */
async function siteOrigin() {
  const envUrl = process.env.NEXTAUTH_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function SettingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const member = await getCurrentMember();
  const canEdit = hasPermission(member?.role, "settings.manage");
  const canManageStaff = hasPermission(member?.role, "staff.manage");

  const [team, origin] = await Promise.all([
    prisma.tenantMember.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { created_at: "asc" },
      select: {
        id: true, role: true, display_name: true, title: true,
        user: { select: { name: true, email: true } },
      },
    }),
    siteOrigin(),
  ]);

  const currentPrice = calculateMonthlyPrice(tenant.packs);
  const trialEligible = canEdit && canStartTrial(tenant);
  const hasDemoData = tenant.settings?.demo_data === true;
  const bookingUrl = `${origin}/book/${tenant.slug}`;
  const dodoState = readDodoState(tenant.settings as Record<string, unknown>);
  const dodoCustomerId = dodoState.customerId;
  const currentInterval = currentBillingInterval(dodoState);
  const timeZone = normalizeTimeZone((tenant.settings as Record<string, unknown>)?.time_zone);

  return (
    <div>
      <PageHead title="Settings" sub="Your shop, your plan and your account" />

      {params?.success === "saved" && (
        <div className="mb-6 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)]">
          Your shop details have been saved.
        </div>
      )}
      {params?.success === "subscribed" && (
        <div className="mb-6 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)]">
          Payment received — thank you! Your new modules unlock within a few seconds.
          <SubscriptionRefresher />
        </div>
      )}
      {params?.success === "trial_started" && (
        <div className="mb-6 rounded-2xl border border-gold/30 bg-gold-soft px-4 py-3 text-sm font-medium text-gold">
          Your {TRIAL_DAYS}-day free trial has started. The modules are unlocked right away — no card needed.
        </div>
      )}
      {params?.success === "demo_loaded" && (
        <div className="mb-6 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)]">
          Sample data added. Remove it any time from this page — your own records are never touched.
        </div>
      )}
      {params?.success === "demo_cleared" && (
        <div className="mb-6 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)]">
          Sample data removed.
        </div>
      )}
      {params?.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-late">
          {ERRORS[params.error] ?? "Something went wrong."}
        </div>
      )}

      <div className="grid gap-6">
        {/* Shop profile */}
        <div className="bg-white rounded-2xl border border-[var(--line)] p-6">
          <h2 className="font-serif text-lg text-[var(--ink)] mb-1">Shop details</h2>
          <p className="text-sm text-[var(--muted)] mb-5">
            These appear on your public booking page and in the client portal.
          </p>

          {canEdit ? (
            <form action={updateShopProfile} className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="shop-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Shop Name</label>
                  <input
                    id="shop-name"
                    name="name"
                    required
                    defaultValue={tenant.name}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-stone-400"
                  />
                </div>
                <div>
                  <label htmlFor="booking-slug" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Booking Address</label>
                  <div className="flex items-center rounded-xl border border-stone-200 overflow-hidden focus-within:border-[var(--ink)]">
                    <span className="px-3 py-2.5 text-xs text-[var(--muted)] bg-stone-50 border-r border-[var(--line)] whitespace-nowrap font-mono">
                      /book/
                    </span>
                    <input
                      id="booking-slug"
                      name="slug"
                      required
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      defaultValue={tenant.slug}
                      className="flex-1 px-3 py-2.5 text-sm outline-none font-mono"
                    />
                  </div>
                  <p className="text-xs text-amber-600 mt-1">
                    Changing this breaks any booking links you have already shared.
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="logo-url" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Logo URL</label>
                <input
                  id="logo-url"
                  name="logo_url"
                  type="url"
                  defaultValue={tenant.logo_url ?? ""}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-stone-400"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="primary-color" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      id="primary-color"
                      name="primary_color"
                      type="color"
                      defaultValue={tenant.primary_color ?? "#0A0A0C"}
                      className="h-11 w-14 rounded-xl border border-stone-200 bg-white cursor-pointer"
                    />
                    <span className="text-xs text-[var(--muted)]">Headings and buttons</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="accent-color" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      id="accent-color"
                      name="accent_color"
                      type="color"
                      defaultValue={tenant.accent_color ?? "#2563EB"}
                      className="h-11 w-14 rounded-xl border border-stone-200 bg-white cursor-pointer"
                    />
                    <span className="text-xs text-[var(--muted)]">Booking page highlights</span>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="shop-time-zone" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Shop time zone</label>
                <select
                  id="shop-time-zone"
                  name="time_zone"
                  defaultValue={timeZone}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:border-stone-400 focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-1"
                >
                  {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  {!TIME_ZONE_OPTIONS.some((option) => option.value === timeZone) && <option value={timeZone}>{timeZone}</option>}
                </select>
                <p className="text-xs text-[var(--muted)] mt-1">Used for the public booking calendar and date validation.</p>
              </div>

              <label className="flex items-start gap-3 p-4 rounded-xl border border-[var(--line)] cursor-pointer hover:border-stone-300 transition-colors">
                <input
                  type="checkbox"
                  name="briefing_emails"
                  defaultChecked={tenant.briefing_emails !== false}
                  className="mt-0.5 w-4 h-4 accent-[var(--ink)]"
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--ink)]">Daily briefing email</span>
                  <span className="block text-xs text-[var(--muted)] mt-0.5">
                    Each morning we email you what needs chasing: unanswered bookings, overdue
                    payments, brides who loved a gown but have not ordered. Nothing is sent on a
                    quiet day.
                  </span>
                </span>
              </label>

              <div>
                <SubmitButton
                  pendingLabel="Saving changes…"
                  className="px-5 py-2.5 bg-[var(--ink)] text-white rounded-xl text-sm font-medium hover:bg-stone-800 disabled:opacity-60 disabled:cursor-wait"
                >
                  Save Changes
                </SubmitButton>
              </div>
            </form>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Shop Name</label>
                <div className="px-4 py-2.5 rounded-xl bg-stone-50 text-sm text-[var(--ink)]">{tenant.name}</div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Plan</label>
                <div className="px-4 py-2.5 rounded-xl bg-stone-50 text-sm text-[var(--ink)] capitalize">{tenant.plan}</div>
              </div>
            </div>
          )}
        </div>

        {/* Public booking link */}
        <div className="bg-white rounded-2xl border border-[var(--line)] p-6">
          <h2 className="font-serif text-lg text-[var(--ink)] mb-1">Public booking link</h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Share this with clients so they can book appointments themselves.
          </p>
          <CopyField value={bookingUrl} />
          <a
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-[var(--ink)] hover:text-[var(--ink)]"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            Preview your booking page
          </a>
        </div>

        {/* Team */}
        <div className="bg-white rounded-2xl border border-[var(--line)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-[var(--ink)]">Team</h2>
            {canManageStaff && (
              <a href="/staff" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
                Manage staff
              </a>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {team.map((m) => {
              const name = m.display_name || m.user.name || m.user.email;
              return (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--line)]">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--ink)] truncate">{name}</div>
                    <div className="text-xs text-[var(--muted)] truncate">
                      {m.user.email}
                      {m.title ? ` · ${m.title}` : ""}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[var(--muted)] bg-stone-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                    {ROLE_LABELS[normalizeRole(m.role)]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-2xl border border-[var(--line)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-[var(--ink)]">Subscription</h2>
            <div className="text-sm font-medium text-[var(--muted)]">{formatPrice(currentPrice)}/mo</div>
          </div>
          <div className="flex gap-3">
            <UpgradeButton currentPacks={tenant.packs} currentInterval={currentInterval} billingConfigured={BILLING_CONFIGURED} billingAnnualConfigured={BILLING_ANNUAL_CONFIGURED} />
            {Boolean(dodoCustomerId) && <ManageBillingButton />}
          </div>
          {canEdit && (
            <p className="mt-4 text-xs text-[var(--muted)]">
              Run more than one shop?{" "}
              <a
                href="mailto:hello@bridalstack.com?subject=Multi-location%20BridalStack"
                className="font-semibold text-[var(--ink)] underline underline-offset-2 hover:text-gold rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                Talk to us about multi-location
              </a>
              .
            </p>
          )}
        </div>

        {/* Active Packs */}
        <div className="bg-white rounded-2xl border border-[var(--line)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-[var(--ink)]">Your modules</h2>
            <div className="text-sm font-medium text-[var(--muted)]">{formatPrice(currentPrice)}/mo</div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_PACK_IDS.map((packId) => {
              const pack = PACKS[packId];
              const onTrial = tenant.trial_packs.includes(packId);
              const isActive = tenant.packs.includes(packId) || onTrial;
              const sellable = pack.monthlyPrice === 0 || isPackSellable(packId);
              return (
                <div
                  key={packId}
                  className={`p-4 rounded-xl border-2 transition-colors ${
                    isActive ? "border-[var(--ink)] bg-stone-50" : "border-[var(--line)] bg-white opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-[var(--ink)]">{pack.name}</h3>
                    {onTrial ? (
                      <span className="text-xs font-medium text-gold bg-gold-soft px-2 py-0.5 rounded-full">
                        Trial · {tenant.trial_days_left}d left
                      </span>
                    ) : isActive ? (
                      <span className="text-xs font-medium text-gold bg-gold-soft px-2 py-0.5 rounded-full">Active</span>
                    ) : !sellable ? (
                      <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">In development</span>
                    ) : (
                      <span className="text-xs font-medium text-[var(--muted)]">{pack.monthlyPrice === 0 ? "Included" : `${formatPrice(pack.monthlyPrice)}/mo${BILLING_ANNUAL_CONFIGURED ? ` · ${formatPrice(annualPrice(pack.monthlyPrice))}/yr` : ""}`}</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)] mb-3">{pack.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {pack.modules.map((moduleId) => {
                      const live = isModuleLive(moduleId);
                      return (
                        <span
                          key={moduleId}
                          className={`text-[10px] px-2 py-0.5 rounded ${
                            live ? "bg-stone-100 text-[var(--muted)]" : "bg-amber-50 text-amber-700 border border-amber-100"
                          }`}
                        >
                          {MODULES[moduleId]?.name}
                          {live ? "" : " · soon"}
                        </span>
                      );
                    })}
                  </div>
                  {trialEligible && sellable && !isActive && (
                    <form action={startPackTrial} className="mt-3">
                      <input type="hidden" name="pack" value={packId} />
                      <button
                        type="submit"
                        className="w-full text-xs font-medium text-white bg-[var(--ink)] hover:bg-stone-800 rounded-lg px-3 py-2 transition-colors"
                      >
                        Start {TRIAL_DAYS}-day free trial
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sample data */}
        {canEdit && (
          <div className="bg-white rounded-2xl border border-[var(--line)] p-6">
            <h2 className="font-serif text-lg text-[var(--ink)] mb-1">Sample data</h2>
            <p className="text-sm text-[var(--muted)] mb-4 max-w-2xl">
              Fill the workspace with an example boutique — brides, gowns, orders and
              fittings — so you can see how everything fits together before entering your
              own records. Sample records are tagged and removed in one click; your own
              data is never touched.
            </p>
            {hasDemoData ? (
              <form action={clearDemoData}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--line)] text-sm font-medium text-[var(--ink)] hover:bg-stone-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">delete_sweep</span>
                  Remove sample data
                </button>
              </form>
            ) : (
              <form action={seedDemoData}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--ink)] text-white text-sm font-medium hover:bg-stone-800 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  Load sample data
                </button>
              </form>
            )}
          </div>
        )}

        {/* Account */}
        <div className="bg-white rounded-2xl border border-[var(--line)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-[var(--ink)]">Account</h2>
            <a
              href="/settings/export"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <span className="material-symbols-outlined text-base">download</span>
              Export my data
            </a>
          </div>
          <p className="text-sm text-[var(--muted)] mb-4">
            Download everything in this workspace as JSON — customers, orders, appointments,
            products and the rest.
          </p>
          <SignOutButton />
        </div>

        {/* Danger zone */}
        <div className="bg-white rounded-2xl border border-red-200 p-6">
          <h2 className="text-lg font-serif font-normal text-red-700 mb-1">Delete account</h2>
          <p className="text-sm text-[var(--muted)] mb-5 max-w-2xl">
            This permanently deletes your account and, if you own this workspace, every record in
            it. It cannot be undone. To confirm, type your booking address
            (<span className="font-mono text-[var(--ink)]">{tenant.slug}</span>) and your password.
          </p>
          <form action={deleteAccount} className="grid gap-4 max-w-md">
            <div>
              <label htmlFor="delete-confirm" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Booking address
              </label>
              <input
                id="delete-confirm"
                name="confirm"
                required
                autoComplete="off"
                placeholder={tenant.slug}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-red-500 font-mono"
              />
            </div>
            <div>
              <label htmlFor="delete-password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Password
              </label>
              <input
                id="delete-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-red-500"
              />
            </div>
            <div>
              <SubmitButton
                pendingLabel="Deleting…"
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-wait"
              >
                Delete my account permanently
              </SubmitButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
