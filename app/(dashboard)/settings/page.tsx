import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember } from "@/lib/tenant";
import { PACKS, MODULES, ALL_PACK_IDS, calculateMonthlyPrice } from "@/config/modules";
import { hasPermission, ROLE_LABELS, normalizeRole } from "@/lib/rbac";
import { UpgradeButton, ManageBillingButton } from "@/components/billing-buttons";
import SignOutButton from "@/components/sign-out-button";
import CopyField from "@/components/copy-field";
import { updateShopProfile } from "./actions";

type Props = { searchParams?: Promise<{ success?: string; error?: string }> };

const ERRORS: Record<string, string> = {
  forbidden: "You do not have permission to change these settings.",
  name_required: "Shop name cannot be empty.",
  slug_invalid: "The booking address may only contain lowercase letters, numbers and hyphens.",
  slug_taken: "That booking address is already in use. Try another one.",
  logo_invalid: "The logo address must start with http:// or https://.",
  color_invalid: "Colors must be six-digit hex values, for example #B4496A.",
  update_failed: "Could not save your changes. Please try again.",
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
  const bookingUrl = `${origin}/book/${tenant.slug}`;
  const stripeCustomerId = (tenant.settings as Record<string, unknown>)?.stripe_customer_id;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your shop and subscription</p>
      </div>

      {params?.success === "saved" && (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Your shop details have been saved.
        </div>
      )}
      {params?.error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {ERRORS[params.error] ?? "Something went wrong."}
        </div>
      )}

      <div className="grid gap-6">
        {/* Shop profile */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Shop Details</h2>
          <p className="text-sm text-gray-500 mb-5">
            These appear on your public booking page and in the client portal.
          </p>

          {canEdit ? (
            <form action={updateShopProfile} className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
                  <input
                    name="name"
                    required
                    defaultValue={tenant.name}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Booking Address</label>
                  <div className="flex items-center rounded-xl border border-gray-300 overflow-hidden focus-within:border-gray-900">
                    <span className="px-3 py-2.5 text-xs text-gray-400 bg-gray-50 border-r border-gray-200 whitespace-nowrap font-mono">
                      /book/
                    </span>
                    <input
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input
                  name="logo_url"
                  type="url"
                  defaultValue={tenant.logo_url ?? ""}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-gray-900"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      name="primary_color"
                      type="color"
                      defaultValue={tenant.primary_color ?? "#0A0A0C"}
                      className="h-11 w-14 rounded-xl border border-gray-300 bg-white cursor-pointer"
                    />
                    <span className="text-xs text-gray-500">Headings and buttons</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      name="accent_color"
                      type="color"
                      defaultValue={tenant.accent_color ?? "#2563EB"}
                      className="h-11 w-14 rounded-xl border border-gray-300 bg-white cursor-pointer"
                    />
                    <span className="text-xs text-gray-500">Booking page highlights</span>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
                <div className="px-4 py-2.5 rounded-xl bg-gray-50 text-sm text-gray-900">{tenant.name}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <div className="px-4 py-2.5 rounded-xl bg-gray-50 text-sm text-gray-900 capitalize">{tenant.plan}</div>
              </div>
            </div>
          )}
        </div>

        {/* Public booking link */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Public Booking Link</h2>
          <p className="text-sm text-gray-500 mb-4">
            Share this with clients so they can book appointments themselves.
          </p>
          <CopyField value={bookingUrl} />
          <a
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            Preview your booking page
          </a>
        </div>

        {/* Team */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Team</h2>
            {canManageStaff && (
              <a href="/staff" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Manage staff
              </a>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {team.map((m) => {
              const name = m.display_name || m.user.name || m.user.email;
              return (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {m.user.email}
                      {m.title ? ` · ${m.title}` : ""}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                    {ROLE_LABELS[normalizeRole(m.role)]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
            <div className="text-sm font-medium text-gray-500">${currentPrice}/mo</div>
          </div>
          <div className="flex gap-3">
            <UpgradeButton currentPacks={tenant.packs} />
            {Boolean(stripeCustomerId) && <ManageBillingButton />}
          </div>
        </div>

        {/* Active Packs */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Modules</h2>
            <div className="text-sm font-medium text-gray-500">${currentPrice}/mo</div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_PACK_IDS.map((packId) => {
              const pack = PACKS[packId];
              const isActive = tenant.packs.includes(packId);
              return (
                <div
                  key={packId}
                  className={`p-4 rounded-xl border-2 transition-colors ${
                    isActive ? "border-gray-900 bg-gray-50" : "border-gray-100 bg-white opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{pack.name}</h3>
                    {isActive ? (
                      <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Active</span>
                    ) : (
                      <span className="text-xs font-medium text-gray-400">${pack.monthlyPrice}/mo</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{pack.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {pack.modules.map((moduleId) => (
                      <span key={moduleId} className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {MODULES[moduleId]?.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Account */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
