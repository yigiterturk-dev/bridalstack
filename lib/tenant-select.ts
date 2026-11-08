/**
 * Aktif kiracı (şube) seçiminin SAF çekirdeği.
 *
 * Bir kullanıcı birden çok kiracıya üye olabilir (zincir butik: her şube ayrı
 * bir çalışma alanı). Seçim çerezden gelir ama çerez TEK BAŞINA yetmez:
 * yalnız kullanıcının gerçekten üye olduğu bir kiracı seçilebilir. Üyelik
 * listede yoksa ilk üyeliğe düşeriz — böylece eski/bozuk bir çerez veri
 * sızdırmaz, sadece yok sayılır.
 */
export type TenantMembershipRef = {
  tenantId: string;
  createdAt: string | number | Date;
};

export function chooseTenantId(
  memberships: TenantMembershipRef[],
  preferred?: string | null,
): string | null {
  if (memberships.length === 0) return null;
  if (preferred && memberships.some((m) => m.tenantId === preferred)) return preferred;
  return memberships[0].tenantId;
}
