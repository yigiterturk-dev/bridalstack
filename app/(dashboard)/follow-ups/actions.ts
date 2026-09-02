"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { rateLimit } from "@/lib/ratelimit";
import { sendEmail, followUpEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { FOLLOW_UP_COOLDOWN_DAYS, followUpCooldownCutoff } from "@/lib/follow-ups";

export type SendFollowUpResult = { ok: true; sentAt: string } | { ok: false; error: string };

/**
 * Takip listesindeki bir geline tek tıkla hatırlatma e-postası gönderir.
 *
 * Kapılar sırayla: oturum → yetki → hız sınırı → kiracı sahipliği → e-posta var mı
 * → bekleme süresi. Hepsi geçilirse gönderilir ve kaydı düşülür.
 */
export async function sendFollowUpEmail(
  customerId: string,
  productId?: string | null
): Promise<SendFollowUpResult> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: "Please sign in again." };
  if (!hasPermission(member.role, "customers.manage")) {
    return { ok: false, error: "You do not have permission to email customers." };
  }

  // Toplu gönderim kazasına karşı fren: dakikada en fazla 10 takip e-postası.
  const limit = rateLimit(`follow-up:${member.tenantId}`, 10, 60_000);
  if (!limit.allowed) {
    return { ok: false, error: `Too many emails at once. Try again in ${limit.retryAfter}s.` };
  }

  // RLS yok — müşterinin bu kiracıya ait olduğunu elle doğruluyoruz.
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenant_id: member.tenantId },
    select: { id: true, name: true, email: true },
  });
  if (!customer) return { ok: false, error: "Customer not found." };
  if (!customer.email) return { ok: false, error: "This bride has no email address on file." };

  const cutoff = followUpCooldownCutoff();
  const recent = await prisma.followUpEmail.findFirst({
    where: { tenant_id: member.tenantId, customer_id: customer.id, sent_at: { gte: cutoff } },
    select: { sent_at: true },
  });
  if (recent) {
    return {
      ok: false,
      error: `Already emailed ${recent.sent_at.toLocaleDateString("en-US")}. Wait ${FOLLOW_UP_COOLDOWN_DAYS} days between follow-ups.`,
    };
  }

  const [tenant, product] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: member.tenantId }, select: { name: true } }),
    productId
      ? prisma.product.findFirst({
          where: { id: productId, tenant_id: member.tenantId },
          select: { id: true, name: true },
        })
      : null,
  ]);

  // Portal bağlantısı bonus; üretilemezse e-posta yine de gitsin.
  let portalUrl: string | null = null;
  try {
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    await prisma.portalToken.create({
      data: { tenant_id: member.tenantId, customer_id: customer.id, token },
    });
    portalUrl = `${await siteUrl()}/portal/${token}`;
  } catch {
    portalUrl = null;
  }

  const mail = followUpEmail(
    customer.name,
    tenant?.name ?? "our boutique",
    product?.name ?? null,
    portalUrl
  );

  try {
    await sendEmail({ to: customer.email, subject: mail.subject, html: mail.html });
  } catch {
    return { ok: false, error: "Email provider rejected the message. Try again later." };
  }

  const record = await prisma.followUpEmail.create({
    data: {
      tenant_id: member.tenantId,
      customer_id: customer.id,
      product_id: product?.id ?? null,
      sent_by: member.userId,
    },
    select: { sent_at: true },
  });

  revalidatePath("/follow-ups");
  return { ok: true, sentAt: record.sent_at.toISOString() };
}
