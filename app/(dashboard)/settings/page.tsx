import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { PACKS, MODULES, ALL_PACK_IDS, calculateMonthlyPrice } from "@/config/modules";
import { UpgradeButton, ManageBillingButton } from "@/components/billing-buttons";

export default async function SettingsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const currentPrice = calculateMonthlyPrice(tenant.packs);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your shop and subscription</p>
      </div>

      <div className="grid gap-6">
        {/* Shop Info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Shop Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
              <div className="px-4 py-2.5 rounded-xl bg-gray-50 text-sm text-gray-900">{tenant.name}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <div className="px-4 py-2.5 rounded-xl bg-gray-50 text-sm text-gray-900 capitalize">{tenant.plan}</div>
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
            <div className="text-sm font-medium text-gray-500">${currentPrice}/mo</div>
          </div>
          <div className="flex gap-3 mb-6">
            <UpgradeButton currentPacks={tenant.packs} />
            {(tenant.settings as Record<string, string>)?.stripe_customer_id && <ManageBillingButton />}
          </div>
        </div>

        {/* Active Packs */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Modules</h2>
            <div className="text-sm font-medium text-gray-500">
              ${currentPrice}/mo
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_PACK_IDS.map((packId) => {
              const pack = PACKS[packId];
              const isActive = tenant.packs.includes(packId);
              return (
                <div
                  key={packId}
                  className={`p-4 rounded-xl border-2 transition-colors ${
                    isActive
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-100 bg-white opacity-60"
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

        {/* Sign Out */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
