/**
 * Platform yöneticisi (BridalStack'i işleten kişi) kimliği. Saf modül.
 *
 * Butik sahibi/çalışan rolleriyle ilgisi yok: bunlar kiracı içi yetkiler.
 * Liste `ADMIN_EMAILS` ortam değişkeninden okunur (virgülle ayrılmış).
 * Değişken boşsa kimse yönetici değildir — kapı kapalı başlar.
 */
export function parseAdminEmails(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export function isPlatformAdmin(
  email: string | null | undefined,
  raw: string | undefined | null = process.env.ADMIN_EMAILS,
): boolean {
  if (!email) return false;
  return parseAdminEmails(raw).includes(email.trim().toLowerCase());
}

/** Yeni kayıt bildiriminin gideceği adres. */
export function signupNotifyAddress(
  raw: string | undefined | null = process.env.SIGNUP_NOTIFY_EMAIL,
): string {
  const v = (raw ?? "").trim();
  return v.includes("@") ? v : "hello@bridalstack.com";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c] ?? c);
}

export function signupNoticeEmail(input: {
  email: string;
  shopName: string;
  slug: string;
  timeZone: string | null;
  at: Date;
}): { subject: string; html: string } {
  const shop = input.shopName.replace(/[\r\n]+/g, " ").slice(0, 80);
  return {
    subject: `New signup: ${shop}`,
    html: `<p><strong>${escapeHtml(shop)}</strong> just signed up.</p>
<ul>
<li>Email: ${escapeHtml(input.email)}</li>
<li>Slug: ${escapeHtml(input.slug)}</li>
<li>Time zone: ${escapeHtml(input.timeZone ?? "—")}</li>
<li>At: ${input.at.toISOString()}</li>
</ul>
<p><a href="https://bridalstack.com/ops">Open /ops</a></p>`,
  };
}
