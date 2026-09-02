import { getNavForModules, type ModuleId } from "@/config/modules";
import Sidebar from "@/components/sidebar";
import UpgradeCta from "@/components/upgrade-cta";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // DEV BYPASS: Hardcoded dummy tenant
  const tenant = { name: "Elegance Bridal (Preview)", enabled_modules: ["crm", "appointments", "sales", "inventory"] as ModuleId[] };
  const navGroups = getNavForModules(tenant.enabled_modules);

  const trial = { isPaid: false, daysLeft: 12, expired: false };
  const showCta = true;

  return (
    <div className="min-h-screen bg-[#FDFCFB] selection:bg-rose-200 selection:text-rose-900 font-sans">
      <Sidebar groups={navGroups} tenantName={tenant.name} />
      <main className="lg:ml-[280px] min-h-screen pt-16 lg:pt-0 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-5 lg:px-10 py-8 lg:py-10 bs-animate-in">
          {showCta && trial && (
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
