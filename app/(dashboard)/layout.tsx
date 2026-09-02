import { redirect } from "next/navigation";
import { getNavForModules } from "@/config/modules";
import { getCurrentTenant } from "@/lib/tenant";
import Sidebar from "@/components/sidebar";
import UpgradeCta from "@/components/upgrade-cta";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deneme süresi durumu. Zamanı okumak saf olmayan bir iştir; bileşen gövdesinde
 * değil burada yapılıyor ki render saf kalsın.
 */
function trialState(trialEndsAtIso: string | null | undefined) {
  if (!trialEndsAtIso) return { daysLeft: null, expired: false, active: false };
  const endsAt = new Date(trialEndsAtIso).getTime();
  const now = Date.now();
  return {
    daysLeft: Math.max(0, Math.ceil((endsAt - now) / DAY_MS)),
    expired: endsAt <= now,
    active: true,
  };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const navGroups = getNavForModules(tenant.enabled_modules);

  // Ücretli plandaysa CTA yok. Değilse deneme bitişine kalan gün sayısı gösterilir.
  const isPaid = tenant.plan !== "free" || Boolean(tenant.converted_at);
  const trial = trialState(tenant.trial_ends_at);
  const showCta = !isPaid && trial.active;

  return (
    <div className="min-h-screen bg-[#FDFCFB] selection:bg-rose-200 selection:text-rose-900 font-sans">
      <Sidebar groups={navGroups} tenantName={tenant.name} />
      <main className="lg:ml-[280px] min-h-screen pt-16 lg:pt-0 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-5 lg:px-10 py-8 lg:py-10 bs-animate-in">
          {showCta && (
            <div className="mb-8">
              <UpgradeCta daysLeft={trial.daysLeft} expired={trial.expired} />
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
