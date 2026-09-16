/**
 * Tanıtım kiracısının kimliği. Saf modül: veritabanı bilmez.
 *
 * `lib/demo-tenant.ts` prisma'yı içeri aldığı için testlerden import
 * edilemiyordu (node test koşucusu `@/` takma adını çözmüyor). Kimlik
 * bilgisi buraya ayrıldı ki hem üretim hem test aynı kaynağı okusun.
 */

/** Ziyaretçinin girdiği hesap. Gizli değil: salt okunur ve herkese açık. */
export const DEMO_EMAIL = "demo@bridalstack.com";
export const DEMO_PASSWORD = "see-the-shop";
export const DEMO_TENANT_SLUG = "demo-atelier";

/** Kiracının sahibi. Oturum açılmaz; Tenant.owner_id boş kalamadığı için var. */
export const DEMO_OWNER_EMAIL = "demo-owner@bridalstack.com";

export function isDemoTenant(tenant: { slug?: string | null } | null | undefined): boolean {
  return tenant?.slug === DEMO_TENANT_SLUG;
}
