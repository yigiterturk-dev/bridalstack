"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";

// Funnel olayı kaydı (cohort analitiği için). Sessizce başarısız olur — UX'i bloklamaz.
export async function trackFunnelEvent(
  event: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const member = await getCurrentMember();
    if (!member) return;
    await prisma.funnelEvent.create({
      data: {
        tenant_id: member.tenantId,
        user_id: member.userId,
        event: String(event).slice(0, 80),
        metadata: metadata as object,
      },
    });
  } catch {
    // analitik hatası kullanıcı akışını etkilemez
  }
}
