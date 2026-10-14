"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createToken, expiresIn } from "@/lib/tokens";
import { sendEmail, passwordResetEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { rateLimit } from "@/lib/ratelimit";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) redirect("/forgot-password?error=email");

  const limit = await rateLimit(`password-reset:${email}`, 3, 15 * 60_000);
  if (!limit.allowed) redirect("/forgot-password?error=retry");

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });

  // Hesap yoksa da aynı mesajı döndürüyoruz: hangi e-postaların kayıtlı
  // olduğunu sızdırmamak için (kullanıcı sayımı saldırısı).
  if (user) {
    const { token, hash } = createToken();

    // Aynı anda tek geçerli bağlantı kalsın; eskiler kullanılmış sayılır.
    await prisma.passwordResetToken.updateMany({
      where: { user_id: user.id, used_at: null },
      data: { used_at: new Date() },
    });

    await prisma.passwordResetToken.create({
      data: { user_id: user.id, token_hash: hash, expires_at: expiresIn(1) },
    });

    const base = await siteUrl();
    const mail = passwordResetEmail(user.name ?? "your shop", `${base}/reset-password/${token}`);
    await sendEmail({ to: email, subject: mail.subject, html: mail.html });
  }

  redirect("/forgot-password?sent=1");
}
