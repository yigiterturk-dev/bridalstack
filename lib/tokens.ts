import { createHash, randomBytes } from "node:crypto";

/**
 * Tek kullanımlık bağlantı jetonları (parola sıfırlama, ekip daveti).
 *
 * Ham jeton yalnızca e-postadaki bağlantıda bulunur; veritabanında sadece
 * SHA-256 özeti saklanır. Böylece veritabanını okuyabilen biri geçerli bir
 * sıfırlama bağlantısı üretemez.
 */
export function createToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function expiresIn(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
