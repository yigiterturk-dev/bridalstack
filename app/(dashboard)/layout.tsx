import { redirect } from "next/navigation";
import { getNavForModules } from "@/config/modules";
import { getCurrentTenant } from "@/lib/tenant";
import Sidebar from "@/components/sidebar";
import UpgradeCta from "@/components/upgrade-cta";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const navGroups = getNavForModules(tenant.enabled_modules);

  // Ücretli plandaysa CTA yok. Değilse deneme bitişine kalan gün sayısı gösterilir.
  const isPaid = tenant.plan !== "free" || Boolean(tenant.converted_at);
  const trialEndsAt = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / DAY_MS))
    : null;
  const expired = trialEndsAt !== null && trialEndsAt.getTime() <= Date.now();
  const showCta = !isPaid && trialEndsAt !== null;

  return (
    <div className="min-h-screen bg-[#FDFCFB] selection:bg-rose-200 selection:text-rose-900 font-sans">
      <Sidebar groups={navGroups} tenantName={tenant.name} />
      <main className="lg:ml-[280px] min-h-screen pt-16 lg:pt-0 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-5 lg:px-10 py-8 lg:py-10 bs-animate-in">
          {showCta && (
            <div className="mb-8">
              <UpgradeCta daysLeft={daysLeft} expired={expired} />
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
