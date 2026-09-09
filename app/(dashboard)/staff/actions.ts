"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission, ASSIGNABLE_ROLES, ROLE_LABELS, normalizeRole, type Role } from "@/lib/rbac";
import { createToken, expiresIn } from "@/lib/tokens";
import { sendEmail, teamInviteEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { inviteLink, isInviteActionable } from "@/lib/invitations";

// Yetki kapısı (fail-closed): staff.manage izni olmayan reddedilir.
async function requireStaffManager() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "staff.manage")) redirect("/staff?error=forbidden");
  return { member };
}

export async function addMember(formData: FormData) {
  const { member } = await requireStaffManager();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "stylist").trim() as Role;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/staff?error=email");
  if (!ASSIGNABLE_ROLES.includes(role)) redirect("/staff?error=role");

  // Kullanıcı zaten kayıtlıysa doğrudan üye yap.
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    await prisma.tenantMember.upsert({
      where: { tenant_id_user_id: { tenant_id: member.tenantId, user_id: user.id } },
      update: { role },
      create: { tenant_id: member.tenantId, user_id: user.id, role },
    });
    revalidatePath("/staff");
    redirect("/staff?success=added");
  }

  // Kayıtlı değilse gerçek bir davet üret ve gönder. Aynı e-postaya ikinci
  // davet eskisinin yerine geçer, böylece tek geçerli bağlantı kalır.
  const tenant = await prisma.tenant.findUnique({
    where: { id: member.tenantId },
    select: { name: true },
  });
  const { token, hash } = createToken();

  await prisma.invitation.upsert({
    where: { tenant_id_email: { tenant_id: member.tenantId, email } },
    update: { role, token_hash: hash, invited_by: member.userId, expires_at: expiresIn(24 * 7), accepted_at: null },
    create: {
      tenant_id: member.tenantId, email, role, token_hash: hash,
      invited_by: member.userId, expires_at: expiresIn(24 * 7),
    },
  });

  const base = await siteUrl();
  const mail = teamInviteEmail(
    tenant?.name ?? "the team",
    inviteLink(base, token),
    ROLE_LABELS[normalizeRole(role)]
  );
  const delivery = await sendEmail({ to: email, subject: mail.subject, html: mail.html });

  revalidatePath("/staff");
  // Posta gitmediyse davet yine de geçerlidir; yönetici bağlantıyı bekleyen
  // davetler listesinden elle üretip iletebilir.
  redirect(delivery.sent ? "/staff?success=invited" : "/staff?success=invited_nomail");
}

export async function updateRole(formData: FormData) {
  const { member } = await requireStaffManager();

  const id = String(formData.get("id") || "").trim();
  const role = String(formData.get("role") || "").trim() as Role;
  if (!id || !ASSIGNABLE_ROLES.includes(role)) redirect("/staff?error=role");

  // Tenant kapsamı: yalnızca aynı tenant'taki ve owner OLMAYAN üyeler güncellenebilir.
  await prisma.tenantMember.updateMany({
    where: { id, tenant_id: member.tenantId, role: { not: "owner" } },
    data: { role },
  });

  revalidatePath("/staff");
  redirect("/staff?success=role_updated");
}

export async function removeMember(formData: FormData) {
  const { member } = await requireStaffManager();

  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  // Kendini ve owner'ı silmeyi engelle; yalnızca kendi tenant'ı içinde.
  await prisma.tenantMember.deleteMany({
    where: {
      id,
      tenant_id: member.tenantId,
      role: { not: "owner" },
      user_id: { not: member.userId },
    },
  });

  revalidatePath("/staff");
  redirect("/staff?success=removed");
}

/**
 * Bekleyen davet için yeni bağlantı üretir ve HAM bağlantıyı çağırana döndürür.
 *
 * Bağlantı adres çubuğuna veya yönlendirme sorgusuna hiç girmez (tarayıcı
 * geçmişine ve sunucu günlüklerine sızmasın diye) — yalnız bu çağrının
 * yanıtında bulunur. Yeni jeton eskisini geçersiz kılar.
 */
export async function regenerateInvite(invitationId: string): Promise<{ link?: string; error?: string }> {
  const { member } = await requireStaffManager();

  const invitation = await prisma.invitation.findFirst({
    // Kiracı süzgeci şart: başka mağazanın davetine bağlantı üretilemez.
    where: { id: invitationId, tenant_id: member.tenantId },
    select: { id: true, expires_at: true, accepted_at: true },
  });
  if (!invitation) return { error: "not_found" };
  if (!isInviteActionable(invitation)) return { error: "accepted" };

  const { token, hash } = createToken();
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { token_hash: hash, expires_at: expiresIn(24 * 7) },
  });

  const base = await siteUrl();
  revalidatePath("/staff");
  return { link: inviteLink(base, token) };
}

export async function revokeInvite(formData: FormData) {
  const { member } = await requireStaffManager();

  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.invitation.deleteMany({ where: { id, tenant_id: member.tenantId } });
  }

  revalidatePath("/staff");
  redirect("/staff?success=invite_revoked");
}
