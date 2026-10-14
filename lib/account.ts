import { prisma } from "./prisma.ts";

/**
 * Kiracının işletme verisini tek bir JSON nesnesine toplar.
 * CCPA/GDPR "veriyi dışa aktar" talebi için: ham kayıtlar, sunucudan indirilir.
 */
export async function exportTenantData(tenantId: string) {
  const [
    tenant,
    members,
    customers,
    products,
    orders,
    appointments,
    services,
    bookings,
    contracts,
    installments,
    suppliers,
    purchaseOrders,
    cashMovements,
    checks,
    rentals,
    commissionRules,
  ] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true, name: true, slug: true, packs: true, plan: true,
        settings: true, created_at: true, trial_started_at: true, trial_ends_at: true, converted_at: true,
      },
    }),
    prisma.tenantMember.findMany({
      where: { tenant_id: tenantId },
      select: { role: true, display_name: true, title: true, created_at: true, user: { select: { email: true, name: true } } },
    }),
    prisma.customer.findMany({ where: { tenant_id: tenantId } }),
    prisma.product.findMany({ where: { tenant_id: tenantId } }),
    prisma.order.findMany({ where: { tenant_id: tenantId }, include: { lines: true } }),
    prisma.appointment.findMany({ where: { tenant_id: tenantId } }),
    prisma.service.findMany({ where: { tenant_id: tenantId } }),
    prisma.booking.findMany({ where: { tenant_id: tenantId } }),
    prisma.contract.findMany({ where: { tenant_id: tenantId } }),
    prisma.installment.findMany({ where: { tenant_id: tenantId } }),
    prisma.supplier.findMany({ where: { tenant_id: tenantId } }),
    prisma.purchaseOrder.findMany({ where: { tenant_id: tenantId }, include: { lines: true } }),
    prisma.cashMovement.findMany({ where: { tenant_id: tenantId } }),
    prisma.check.findMany({ where: { tenant_id: tenantId } }),
    prisma.rental.findMany({ where: { tenant_id: tenantId } }),
    prisma.commissionRule.findMany({ where: { tenant_id: tenantId } }),
  ]);

  return {
    exported_at: new Date().toISOString(),
    export_version: 1,
    tenant,
    staff: members,
    customers,
    products,
    orders,
    appointments,
    services,
    bookings,
    contracts,
    installments,
    suppliers,
    purchase_orders: purchaseOrders,
    cash_movements: cashMovements,
    checks,
    rentals,
    commission_rules: commissionRules,
  };
}

/**
 * Kullanıcı hesabını kalıcı olarak siler.
 *
 * Sıra önemli: Tenant.owner ilişkisi cascade'siz (kısıtlayıcı), bu yüzden
 * kullanıcı silinmeden önce sahip olduğu kiracılar silinmeli. Bir kiracıyı
 * silmek alt kayıtlarını (müşteri, sipariş, randevu...) cascade ile götürür.
 * Kullanıcının başka kiracılardaki üyelikleri de temizlenir; o kiracılar ve
 * diğer üyeleri etkilenmez.
 *
 * Çağıran, kimlik ve parola doğrulamasını yaptıktan sonra bunu çağırır.
 */
export async function deleteAccountData(userId: string): Promise<{ deletedTenants: number }> {
  return prisma.$transaction(
    async (tx) => {
      const owned = await tx.tenant.findMany({ where: { owner_id: userId }, select: { id: true } });
      const ownedIds = owned.map((t) => t.id);

      if (ownedIds.length > 0) {
        await tx.tenant.deleteMany({ where: { id: { in: ownedIds } } });
      }
      await tx.tenantMember.deleteMany({ where: { user_id: userId } });
      await tx.user.delete({ where: { id: userId } });

      return { deletedTenants: ownedIds.length };
    },
    { maxWait: 10_000, timeout: 60_000 }
  );
}
