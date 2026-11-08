"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantId } from "@/lib/tenant";

export type BrideHit = { id: string; name: string; event_date: string | null };

/** ⌘K gelin araması: yalnız bu butiğin gelinleri, ad/telefon/e-postada, en çok 6. */
export async function searchBrides(query: string): Promise<BrideHit[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const tenantId = await requireTenantId();
  return prisma.customer.findMany({
    where: {
      tenant_id: tenantId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, event_date: true },
    orderBy: { updated_at: "desc" },
    take: 6,
  });
}
