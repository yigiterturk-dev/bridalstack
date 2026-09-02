import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "BridalStack <noreply@bridalstack.com>";

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.log(`[EMAIL SKIP] to=${to} subject=${subject}`);
    return;
  }

  await resend.emails.send({ from: FROM, to, subject, html });
}

export function appointmentReminderEmail(customerName: string, shopName: string, date: string, time: string) {
  return {
    subject: `Appointment Reminder — ${shopName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Hi ${customerName} 👋</h2>
        <p style="color: #555; line-height: 1.6;">
          This is a reminder that you have an upcoming appointment at <strong>${shopName}</strong>.
        </p>
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0; color: #111; font-size: 18px; font-weight: 600;">📅 ${date}</p>
          <p style="margin: 4px 0 0; color: #555;">🕐 ${time}</p>
        </div>
        <p style="color: #555; line-height: 1.6;">
          We look forward to seeing you! If you need to reschedule, please contact us.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent via BridalStack</p>
      </div>
    `,
  };
}

export function paymentReminderEmail(customerName: string, shopName: string, amount: string, dueDate: string) {
  return {
    subject: `Payment Reminder — ${shopName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Hi ${customerName} 👋</h2>
        <p style="color: #555; line-height: 1.6;">
          You have an upcoming payment due at <strong>${shopName}</strong>.
        </p>
        <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0; color: #111; font-size: 24px; font-weight: 700;">${amount}</p>
          <p style="margin: 4px 0 0; color: #b91c1c;">Due: ${dueDate}</p>
        </div>
        <p style="color: #555; line-height: 1.6;">
          Please contact us if you have any questions about your payment.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent via BridalStack</p>
      </div>
    `,
  };
}

// Taksit hatırlatma e-postası (Türkçe) — kind'a göre ton değişir.
export function installmentReminderEmail(
  customerName: string,
  shopName: string,
  amount: string,
  dueDate: string,
  kind: "upcoming" | "due_today" | "overdue"
) {
  const heading =
    kind === "overdue"
      ? "Gecikmiş taksit ödemeniz var"
      : kind === "due_today"
      ? "Bugün taksit ödeme gününüz"
      : "Yaklaşan taksit ödemeniz";
  const accent = kind === "overdue" ? "#b91c1c" : kind === "due_today" ? "#d97706" : "#111";
  const bg = kind === "overdue" ? "#fef2f2" : kind === "due_today" ? "#fffbeb" : "#f9fafb";
  return {
    subject: `${heading} — ${shopName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Merhaba ${customerName},</h2>
        <p style="color: #555; line-height: 1.6;">
          <strong>${shopName}</strong> nezdindeki taksit ödemenizle ilgili bir hatırlatma.
        </p>
        <div style="background: ${bg}; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0; color: #111; font-size: 24px; font-weight: 700;">${amount}</p>
          <p style="margin: 4px 0 0; color: ${accent};">Vade: ${dueDate}</p>
        </div>
        <p style="color: #555; line-height: 1.6;">
          Sorularınız için bizimle iletişime geçebilirsiniz.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent by Bridal Stack</p>
      </div>
    `,
  };
}

export function welcomeEmail(customerName: string, shopName: string) {
  return {
    subject: `Welcome to ${shopName}!`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Welcome, ${customerName}! 🎉</h2>
        <p style="color: #555; line-height: 1.6;">
          Thank you for choosing <strong>${shopName}</strong>. We're excited to help you find your perfect look.
        </p>
        <p style="color: #555; line-height: 1.6;">
          We'll keep you updated on your appointments, orders, and everything in between.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent via BridalStack</p>
      </div>
    `,
  };
}

export function passwordResetEmail(shopName: string, resetUrl: string) {
  return {
    subject: "Reset your password",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Reset your password</h2>
        <p style="color: #555; line-height: 1.6;">
          We received a request to reset the password for your <strong>${shopName}</strong> account.
          This link works once and expires in one hour.
        </p>
        <p style="margin: 28px 0;">
          <a href="${resetUrl}" style="background:#111827;color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600;display:inline-block;">
            Choose a new password
          </a>
        </p>
        <p style="color: #555; line-height: 1.6; font-size: 14px;">
          If you did not ask for this, you can ignore this email and your password stays unchanged.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent via BridalStack</p>
      </div>
    `,
  };
}

export function teamInviteEmail(shopName: string, inviteUrl: string, roleLabel: string) {
  return {
    subject: `You have been invited to ${shopName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Join ${shopName}</h2>
        <p style="color: #555; line-height: 1.6;">
          You have been invited to join <strong>${shopName}</strong> as <strong>${roleLabel}</strong>.
          This invitation expires in seven days.
        </p>
        <p style="margin: 28px 0;">
          <a href="${inviteUrl}" style="background:#111827;color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600;display:inline-block;">
            Accept invitation
          </a>
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent via BridalStack</p>
      </div>
    `,
  };
}
