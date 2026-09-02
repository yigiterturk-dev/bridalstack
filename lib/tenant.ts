import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ModuleId, PackId, getModulesForPacks } from "@/config/modules";
import { normalizeRole, type Role } from "@/lib/rbac";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  packs: PackId[];
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

/** Oturumdaki kullanıcının id'si — yoksa null. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function getCurrentTenant(): Promise<Tenant | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const membership = await prisma.tenantMember.findFirst({
    where: { user_id: userId },
    select: { tenant: true },
  });

  const tenant = membership?.tenant;
  if (!tenant) return null;

  const packs = (tenant.packs?.length ? tenant.packs : ["base"]) as PackId[];

  return {
    ...tenant,
    packs,
    enabled_modules: getModulesForPacks(packs),
    settings: (tenant.settings ?? {}) as Record<string, unknown>,
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

  const membership = await prisma.tenantMember.findFirst({
    where: { user_id: userId },
    select: { id: true, tenant_id: true, role: true },
  });

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
