/**
 * Ekip davetlerinin saf kuralları.
 *
 * Davet bağlantısı yalnızca ham jetonu bilen kişide bulunur; veritabanında
 * sadece özeti durur (bkz. lib/tokens.ts). Bu yüzden "bağlantıyı tekrar göster"
 * diye bir şey yoktur — yeni bağlantı üretmek eskisini geçersiz kılar.
 */

export type InviteRecord = { expires_at: Date | string; accepted_at: Date | string | null };
export type InviteStatus = "accepted" | "expired" | "pending";

export function inviteStatus(invitation: InviteRecord, now: Date = new Date()): InviteStatus {
  if (invitation.accepted_at) return "accepted";
  // Sınır anı dolmuş sayılır: geçerlilik penceresi expires_at'ten ÖNCEsidir.
  return new Date(invitation.expires_at).getTime() <= now.getTime() ? "expired" : "pending";
}

/** Süresi dolmuş davet yenilenebilir; kabul edilmiş davete dokunulmaz. */
export function isInviteActionable(invitation: InviteRecord, now: Date = new Date()): boolean {
  return inviteStatus(invitation, now) !== "accepted";
}

export function inviteLink(baseUrl: string, token: string): string {
  if (!token) throw new Error("invite token is empty");
  return `${baseUrl.replace(/\/+$/, "")}/invite/${token}`;
}
