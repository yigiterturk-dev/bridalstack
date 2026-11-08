import { redirect } from "next/navigation";
import { getNavForModules } from "@/config/modules";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { isDemoTenant } from "@/lib/demo-identity";
import Sidebar from "@/components/sidebar";
import UpgradeCta from "@/components/upgrade-cta";
import DemoBanner from "@/components/demo-banner";
import DemoTour from "@/components/demo-tour";
import DemoReadOnly from "@/components/demo-readonly";
import { trialDaysLeft } from "@/lib/trial";
import { NO_INDEX } from "@/lib/seo";
import type { Metadata } from "next";

// Oturum arkasındaki hiçbir ekran indekslenmez.
export const metadata: Metadata = NO_INDEX;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [tenant, userId] = await Promise.all([getCurrentTenant(), getCurrentUserId()]);
  if (!tenant) redirect("/onboarding");

  // Kullanıcının tüm şubeleri (kiracıları) — kenar çubuğundaki şube seçici için.
  const memberships = userId
    ? await prisma.tenantMember.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "asc" },
        select: { tenant_id: true, tenant: { select: { name: true } } },
      })
    : [];
  const locations = memberships.map((m) => ({ id: m.tenant_id, name: m.tenant.name }));

  const navGroups = getNavForModules(tenant.enabled_modules);

  // Ücretli plandaysa CTA yok. Değilse deneme bitişine kalan gün sayısı gösterilir.
  const isPaid = tenant.plan !== "free" || Boolean(tenant.converted_at);
  // Gün hesabı tek yerden (lib/trial) okunur; modül kapısıyla aynı sayıyı
  // göstermezse kullanıcı "gün var ama modül kapalı" ile karşılaşır.
  const daysLeft = trialDaysLeft(tenant.trial_ends_at, new Date());
  const showCta = !isPaid && daysLeft !== null;
  // Tanıtım kiracısında yükseltme CTA'sının anlamı yok: ziyaretçinin hesabı
  // değil. Onun yerine "kendi butiğini kur" şeridi çıkar.
  const demo = isDemoTenant(tenant);

  return (
    <div className="min-h-screen bg-[#FDFCFB] selection:bg-rose-200 selection:text-rose-900 font-sans">
      <Sidebar groups={navGroups} tenantName={tenant.name} locations={locations} activeTenantId={tenant.id} />
      <main className="lg:ml-[280px] min-h-screen pt-16 lg:pt-0 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-5 lg:px-10 py-8 lg:py-10 bs-animate-in">
          {demo && <DemoBanner />}
          {!demo && showCta && (
            <div className="mb-8">
              <UpgradeCta daysLeft={daysLeft} expired={daysLeft === 0} />
            </div>
          )}
          {children}
        </div>
      </main>
      {demo && <DemoTour />}
      {demo && <DemoReadOnly />}
    </div>
  );
}
