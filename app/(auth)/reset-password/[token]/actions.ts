"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";

const MIN_LENGTH = 8;

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!token) redirect("/forgot-password?error=email");
  if (password.length < MIN_LENGTH) redirect(`/reset-password/${token}?error=short`);
  if (password !== confirm) redirect(`/reset-password/${token}?error=mismatch`);

  const record = await prisma.passwordResetToken.findUnique({
    where: { token_hash: hashToken(token) },
    select: { id: true, user_id: true, used_at: true, expires_at: true },
  });

  if (!record || record.used_at || record.expires_at <= new Date()) {
    redirect(`/reset-password/${token}?error=invalid`);
  }

  const password_hash = await bcrypt.hash(password, 12);

  // Jetonu tüketmek ve parolayı yazmak tek işlemde: yarı yolda kalırsa
  // jeton tekrar kullanılabilir durumda kalmasın.
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.user_id }, data: { password_hash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used_at: new Date() } }),
    prisma.passwordResetToken.updateMany({
      where: { user_id: record.user_id, used_at: null },
      data: { used_at: new Date() },
    }),
  ]);

  redirect("/login?reset=1");
}
