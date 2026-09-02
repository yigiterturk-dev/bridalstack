"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { getCurrentUserId } from "@/lib/tenant";

const MIN_LENGTH = 8;

async function loadInvite(token: string) {
  const invite = await prisma.invitation.findUnique({
    where: { token_hash: hashToken(token) },
    select: { id: true, tenant_id: true, email: true, role: true, accepted_at: true, expires_at: true },
  });
  if (!invite || invite.accepted_at || invite.expires_at <= new Date()) return null;
  return invite;
}

/** Zaten oturumu olan kullanıcı daveti kabul eder. */
export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const invite = await loadInvite(token);
  if (!invite) redirect(`/invite/${token}?error=invalid`);

  const userId = await getCurrentUserId();
  if (!userId) redirect(`/login?callbackUrl=/invite/${token}`);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  // Davet belirli bir adrese yazıldı; başka bir hesapla kabul edilemez.
  if (user?.email !== invite.email) redirect(`/invite/${token}?error=wrong_account`);

  await prisma.$transaction([
    prisma.tenantMember.upsert({
      where: { tenant_id_user_id: { tenant_id: invite.tenant_id, user_id: userId } },
      update: { role: invite.role },
      create: { tenant_id: invite.tenant_id, user_id: userId, role: invite.role },
    }),
    prisma.invitation.update({ where: { id: invite.id }, data: { accepted_at: new Date() } }),
  ]);

  redirect("/dashboard");
}

/** Hesabı olmayan davetli, parolasını belirleyerek hem kaydolur hem katılır. */
export async function acceptInviteWithSignup(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  const invite = await loadInvite(token);
  if (!invite) redirect(`/invite/${token}?error=invalid`);
  if (password.length < MIN_LENGTH) redirect(`/invite/${token}?error=short`);
  if (password !== confirm) redirect(`/invite/${token}?error=mismatch`);

  const existing = await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } });
  if (existing) redirect(`/login?callbackUrl=/invite/${token}`);

  const password_hash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: invite.email, password_hash, name: name || null },
    });
    await tx.tenantMember.create({
      data: { tenant_id: invite.tenant_id, user_id: user.id, role: invite.role, display_name: name || null },
    });
    await tx.invitation.update({ where: { id: invite.id }, data: { accepted_at: new Date() } });
  });

  redirect(`/login?joined=1&callbackUrl=/dashboard`);
}
