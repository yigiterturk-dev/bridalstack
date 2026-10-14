import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "BridalStack <noreply@bridalstack.com>";

export type EmailResult = { sent: boolean; reason?: "unconfigured" | "failed" };
const EMAIL_TIMEOUT_MS = 5_000;

/**
 * Yalnızca yerel/geliştirme ortamında: sağlayıcı çağrısı yapmadan gönderim
 * başarılı sayılır. Uçtan uca test takımı brifing/hatırlatma cron'larının
 * gönderim yolunu (damga, tekrar gönderim engeli) gerçek bir e-posta anahtarı
 * olmadan sınayabilsin diye. Üretimde NODE_ENV="production" olduğundan yok
 * sayılır — canlıda gönderim sessizce "başarılı" sayılmaz.
 */
function emailDryRun(): boolean {
  return process.env.EMAIL_DRY_RUN === "1" && process.env.NODE_ENV !== "production";
}

export function sanitizeEmailSubject(subject: string): string {
  return subject.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

/**
 * E-posta göndermek hiçbir zaman çağıranı patlatmaz.
 *
 * Davet/hatırlatma gibi işlerde asıl kayıt zaten veritabanına yazılmıştır;
 * sağlayıcı yoksa veya hata verirse işi geri almak yerine gönderilemediğini
 * bildiririz — çağıran da kullanıcıya bağlantıyı elle verebilir.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  if (emailDryRun()) {
    console.log(`[EMAIL DRY-RUN] to=${to} subject=${subject}`);
    return { sent: true };
  }

  if (!resend) {
    console.log(`[EMAIL SKIP] to=${to} subject=${subject}`);
    return { sent: false, reason: "unconfigured" };
  }

  try {
    const { error } = await withTimeout(
      resend.emails.send({ from: FROM, to, subject: sanitizeEmailSubject(subject), html }),
      EMAIL_TIMEOUT_MS
    );
    if (error) {
      console.error(`[EMAIL FAIL] to=${to} subject=${subject} error=${error.message}`);
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[EMAIL FAIL] to=${to} subject=${subject} error=${String(err)}`);
    return { sent: false, reason: "failed" };
  }
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Email provider timed out")), milliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

export function appointmentReminderEmail(customerName: string, shopName: string, date: string, time: string) {
  const safeCustomer = escapeHtml(customerName);
  const safeShop = escapeHtml(shopName);
  const safeDate = escapeHtml(date);
  const safeTime = escapeHtml(time);
  return {
    subject: `Appointment Reminder — ${shopName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Hi ${safeCustomer} 👋</h2>
        <p style="color: #555; line-height: 1.6;">
          This is a reminder that you have an upcoming appointment at <strong>${safeShop}</strong>.
        </p>
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0; color: #111; font-size: 18px; font-weight: 600;">📅 ${safeDate}</p>
          <p style="margin: 4px 0 0; color: #555;">🕐 ${safeTime}</p>
        </div>
        <p style="color: #555; line-height: 1.6;">
          We look forward to seeing you! If you need to reschedule, please contact us.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent via BridalStack</p>
      </div>
    `,
  };
}

export function bookingRequestEmail(
  customerName: string,
  shopName: string,
  serviceName: string,
  date: string,
  time: string,
  contact: { email?: string; phone?: string } = {}
) {
  const safeCustomer = escapeHtml(customerName);
  const safeShop = escapeHtml(shopName);
  const safeService = escapeHtml(serviceName);
  const safeDate = escapeHtml(date);
  const safeTime = escapeHtml(time);
  const safeEmail = escapeHtml(contact.email || "");
  const safePhone = escapeHtml(contact.phone || "");
  const contactLine = [safeEmail, safePhone].filter(Boolean).join(" · ");
  return {
    subject: `New booking request — ${shopName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
        <h2 style="color:#111827;margin:0 0 8px;">New booking request</h2>
        <p style="color:#6b7280;line-height:1.6;margin:0 0 24px;">
          ${safeCustomer} requested an appointment at <strong>${safeShop}</strong>.
        </p>
        <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="margin:0;color:#111827;font-weight:600;">${safeService}</p>
          <p style="margin:8px 0 0;color:#4b5563;">${safeDate} · ${safeTime}</p>
          ${contactLine ? `<p style="margin:8px 0 0;color:#4b5563;">Contact: ${contactLine}</p>` : ""}
        </div>
        <p style="color:#6b7280;line-height:1.6;">Open BridalStack to review and confirm this request.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:32px;">Sent via BridalStack</p>
      </div>
    `,
  };
}

export function paymentReminderEmail(customerName: string, shopName: string, amount: string, dueDate: string) {
  const safeCustomer = escapeHtml(customerName);
  const safeShop = escapeHtml(shopName);
  const safeAmount = escapeHtml(amount);
  const safeDueDate = escapeHtml(dueDate);
  return {
    subject: `Payment Reminder — ${shopName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Hi ${safeCustomer} 👋</h2>
        <p style="color: #555; line-height: 1.6;">
          You have an upcoming payment due at <strong>${safeShop}</strong>.
        </p>
        <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0; color: #111; font-size: 24px; font-weight: 700;">${safeAmount}</p>
          <p style="margin: 4px 0 0; color: #b91c1c;">Due: ${safeDueDate}</p>
        </div>
        <p style="color: #555; line-height: 1.6;">
          Please contact us if you have any questions about your payment.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent via BridalStack</p>
      </div>
    `,
  };
}

// Installment reminder email — tone changes by kind.
export function installmentReminderEmail(
  customerName: string,
  shopName: string,
  amount: string,
  dueDate: string,
  kind: "upcoming" | "due_today" | "overdue"
) {
  const heading =
    kind === "overdue"
      ? "Your installment payment is overdue"
      : kind === "due_today"
      ? "Your installment payment is due today"
      : "Upcoming installment payment";
  const accent = kind === "overdue" ? "#b91c1c" : kind === "due_today" ? "#d97706" : "#111";
  const bg = kind === "overdue" ? "#fef2f2" : kind === "due_today" ? "#fffbeb" : "#f9fafb";
  const safeCustomer = escapeHtml(customerName);
  const safeShop = escapeHtml(shopName);
  const safeAmount = escapeHtml(amount);
  const safeDueDate = escapeHtml(dueDate);
  return {
    subject: `${heading} — ${shopName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Hi ${safeCustomer},</h2>
        <p style="color: #555; line-height: 1.6;">
          This is a reminder about your installment payment with <strong>${safeShop}</strong>.
        </p>
        <div style="background: ${bg}; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0; color: #111; font-size: 24px; font-weight: 700;">${safeAmount}</p>
          <p style="margin: 4px 0 0; color: ${accent};">Due: ${safeDueDate}</p>
        </div>
        <p style="color: #555; line-height: 1.6;">
          Please contact us if you have any questions about your payment.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent by Bridal Stack</p>
      </div>
    `,
  };
}

export function welcomeEmail(customerName: string, shopName: string) {
  const safeCustomer = escapeHtml(customerName);
  const safeShop = escapeHtml(shopName);
  return {
    subject: `Welcome to ${shopName}!`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Welcome, ${safeCustomer}! 🎉</h2>
        <p style="color: #555; line-height: 1.6;">
          Thank you for choosing <strong>${safeShop}</strong>. We're excited to help you find your perfect look.
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
  const safeShop = escapeHtml(shopName);
  const safeResetUrl = escapeHtml(resetUrl);
  return {
    subject: "Reset your password",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Reset your password</h2>
        <p style="color: #555; line-height: 1.6;">
          We received a request to reset the password for your <strong>${safeShop}</strong> account.
          This link works once and expires in one hour.
        </p>
        <p style="margin: 28px 0;">
          <a href="${safeResetUrl}" style="background:#111827;color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600;display:inline-block;">
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
  const safeShop = escapeHtml(shopName);
  const safeInviteUrl = escapeHtml(inviteUrl);
  const safeRoleLabel = escapeHtml(roleLabel);
  return {
    subject: `You have been invited to ${shopName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Join ${safeShop}</h2>
        <p style="color: #555; line-height: 1.6;">
          You have been invited to join <strong>${safeShop}</strong> as <strong>${safeRoleLabel}</strong>.
          This invitation expires in seven days.
        </p>
        <p style="margin: 28px 0;">
          <a href="${safeInviteUrl}" style="background:#111827;color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600;display:inline-block;">
            Accept invitation
          </a>
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent via BridalStack</p>
      </div>
    `,
  };
}

/** Günlük brifing e-postası. Satırlar buildBriefing çıktısından gelir. */
export function dailyBriefingEmail(
  shopName: string,
  items: { tone: string; title: string; detail: string; href: string }[],
  baseUrl: string
) {
  const toneColor: Record<string, string> = {
    urgent: "#e11d48",
    opportunity: "#059669",
    watch: "#78716c",
  };

  const safeShop = escapeHtml(shopName);
  const safeBaseUrl = escapeHtml(baseUrl);
  const rows = items
    .map(
      (i) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #f0efee;">
            <div style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${toneColor[i.tone] ?? "#78716c"};margin-right:8px;"></div>
            <a href="${safeBaseUrl}${escapeHtml(i.href)}" style="color:#111827;font-weight:600;text-decoration:none;">${escapeHtml(i.title)}</a>
            <div style="color:#6b7280;font-size:14px;margin-top:4px;padding-left:16px;">${escapeHtml(i.detail)}</div>
          </td>
        </tr>`
    )
    .join("");

  return {
    subject: `Today at ${shopName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h2 style="color:#111827;margin:0 0 4px;">Today at ${safeShop}</h2>
        <p style="color:#6b7280;margin:0 0 24px;line-height:1.6;">
          ${items.length === 1 ? "One thing needs" : `${items.length} things need`} your attention.
        </p>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
        <p style="margin:28px 0 0;">
          <a href="${safeBaseUrl}/dashboard" style="background:#111827;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block;">
            Open your dashboard
          </a>
        </p>
        <p style="color:#9ca3af;font-size:12px;margin-top:32px;line-height:1.6;">
          Sent via BridalStack. You can turn these off in Settings.
        </p>
      </div>
    `,
  };
}

/**
 * Takip e-postası — provada bir elbiseye bayılmış ama sipariş vermemiş geline.
 * Satış baskısı yok: hatırlatır, soru sorar, tek tıkla portalına götürür.
 */
export function followUpEmail(
  customerName: string,
  shopName: string,
  gownName: string | null,
  portalUrl: string | null
) {
  const safeCustomer = escapeHtml(customerName);
  const safeGown = gownName ? escapeHtml(gownName) : "";
  const safePortalUrl = portalUrl ? escapeHtml(portalUrl) : "";
  const gownLine = gownName
    ? `You tried on <strong>${safeGown}</strong> with us, and it clearly made an impression.`
    : `You found a gown with us that clearly made an impression.`;

  const cta = portalUrl
    ? `<p style="margin: 28px 0;">
         <a href="${safePortalUrl}" style="background:#111827;color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600;display:inline-block;">
           View your gown
         </a>
       </p>`
    : "";

  return {
    subject: `Still thinking it over? — ${shopName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Hi ${safeCustomer} 👋</h2>
        <p style="color: #555; line-height: 1.6;">${gownLine}</p>
        <p style="color: #555; line-height: 1.6;">
          We wanted to check in before anything changes on our rail. If you have questions about
          sizing, alterations or timing, just reply to this email — we are happy to help.
        </p>
        ${cta}
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent via BridalStack</p>
      </div>
    `,
  };
}

export function trialEndingEmail(shopName: string, packNames: string, daysLeft: number, settingsUrl: string) {
  const safeShop = escapeHtml(shopName);
  const safePackNames = escapeHtml(packNames);
  const safeSettingsUrl = escapeHtml(settingsUrl);
  return {
    subject: `Your BridalStack trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Hi ${safeShop} 👋</h2>
        <p style="color: #555; line-height: 1.6;">
          Your free trial of <strong>${safePackNames}</strong> ends in
          <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>.
        </p>
        <p style="color: #555; line-height: 1.6;">
          Nothing is deleted when it ends — your data stays exactly where it is.
          These modules simply go back to being locked until you subscribe.
        </p>
        <a href="${safeSettingsUrl}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 12px; margin: 20px 0; font-weight: 600;">Keep these modules</a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent via BridalStack</p>
      </div>
    `,
  };
}

export function trialExpiredEmail(shopName: string, packNames: string, settingsUrl: string) {
  const safeShop = escapeHtml(shopName);
  const safePackNames = escapeHtml(packNames);
  const safeSettingsUrl = escapeHtml(settingsUrl);
  return {
    subject: "Your BridalStack trial has ended",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111; margin-bottom: 8px;">Hi ${safeShop} 👋</h2>
        <p style="color: #555; line-height: 1.6;">
          Your free trial of <strong>${safePackNames}</strong> has ended.
          Your customers, orders and appointments are untouched — the free plan
          keeps running as before.
        </p>
        <a href="${safeSettingsUrl}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 12px; margin: 20px 0; font-weight: 600;">Turn these modules back on</a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Sent via BridalStack</p>
      </div>
    `,
  };
}
