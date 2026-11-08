import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chooseTenantId } from "@/lib/tenant-select";
import { ModuleId, PackId, getModulesForPacks } from "@/config/modules";
import { normalizeRole, type Role } from "@/lib/rbac";
import { activeTrialPacks, trialDaysLeft } from "@/lib/trial";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  briefing_emails?: boolean;
  packs: PackId[];
  /** Deneme süresi boyunca ödünç açılan paketler — sahip olunan paketler değil. */
  trial_packs: PackId[];
  trial_days_left: number | null;
  enabled_modules: ModuleId[];
  settings: Record<string, unknown>;
  plan: "free" | "starter" | "growth" | "enterprise";
  created_at: string;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  converted_at?: string | null;
  signup_source?: string | null;
  cohort_month?: string | null;
};

/**
 * Aktif kiracı çerezi. Bir kullanıcı birden çok şubeye (kiracıya) üye
 * olabilir; çerez yalnızca HANGİSİNİN aktif olduğunu söyler. Yetki kararı
 * üyelikten gelir: üye olunmayan bir kiracı çerezle seçilemez.
 */
export const ACTIVE_TENANT_COOKIE = "bs_tenant";

/** Oturumdaki kullanıcının id'si — yoksa null. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

/**
 * Kullanıcının üyeliklerinden aktif olanı seçer.
 *
 * Sıra: çerezdeki kiracı (yalnız üye olunansa) → ilk üyelik. Çerez okuması
 * istek dışı bir bağlamda (ör. statik derleme) hata verirse yok sayılır;
 * yetkilendirme yine üyelik listesinden yapılır.
 */
async function resolveMembership(userId: string) {
  const memberships = await prisma.tenantMember.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "asc" },
    select: { id: true, tenant_id: true, role: true, created_at: true, tenant: true },
  });
  if (memberships.length === 0) return null;

  let preferred: string | null = null;
  try {
    const store = await cookies();
    preferred = store.get(ACTIVE_TENANT_COOKIE)?.value ?? null;
  } catch {
    preferred = null;
  }

  const chosenId = chooseTenantId(
    memberships.map((m) => ({ tenantId: m.tenant_id, createdAt: m.created_at })),
    preferred,
  );
  return memberships.find((m) => m.tenant_id === chosenId) ?? memberships[0];
}

export async function getCurrentTenant(): Promise<Tenant | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const membership = await resolveMembership(userId);
  const tenant = membership?.tenant;
  if (!tenant) return null;

  const packs = (tenant.packs?.length ? tenant.packs : ["base"]) as PackId[];
  const settings = (tenant.settings ?? {}) as Record<string, unknown>;

  // Deneme paketleri kiracıya YAZILMAZ; süresi geçmemişse okuma anında eklenir.
  // Böylece süre dolduğunda modüller kendiliğinden kapanır (bkz. lib/trial.ts).
  const trial_packs = activeTrialPacks(settings, tenant.trial_ends_at, new Date());

  return {
    ...tenant,
    packs,
    trial_packs,
    trial_days_left: trial_packs.length > 0 ? trialDaysLeft(tenant.trial_ends_at, new Date()) : null,
    enabled_modules: getModulesForPacks([...packs, ...trial_packs]),
    settings,
    plan: tenant.plan as Tenant["plan"],
    created_at: tenant.created_at.toISOString(),
    trial_started_at: tenant.trial_started_at?.toISOString() ?? null,
    trial_ends_at: tenant.trial_ends_at?.toISOString() ?? null,
    converted_at: tenant.converted_at?.toISOString() ?? null,
  };
}

export async function getTenantModules(): Promise<ModuleId[]> {
  const tenant = await getCurrentTenant();
  if (!tenant) return ["crm", "appointments"];
  return tenant.enabled_modules;
}

/** Geçerli kullanıcının aktif tenant'taki üyelik kaydı + normalize edilmiş rolü. */
export async function getCurrentMember(): Promise<{
  tenantId: string;
  userId: string;
  memberId: string;
  role: Role;
} | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const membership = await resolveMembership(userId);
  if (!membership) return null;

  return {
    tenantId: membership.tenant_id,
    userId,
    memberId: membership.id,
    role: normalizeRole(membership.role),
  };
}

/**
 * Kiracı izolasyonunun tek kapısı.
 * RLS yok — her sorgu tenant_id ile filtrelenmek ZORUNDA.
 * Oturum yoksa hata fırlatır ki filtresiz sorgu kazara çalışmasın.
 */
export async function requireTenantId(): Promise<string> {
  const member = await getCurrentMember();
  if (!member) throw new Error("Unauthorized: no active tenant for this session");
  return member.tenantId;
}
