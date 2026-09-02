/** Yükleme kuralları — sunucu ve istemci aynı sınırları kullansın diye tek yerde. */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Yükleme yapılandırılmış mı? Token yoksa arayüz yükleme sunmaz. */
export function uploadsEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** İzin verilen yükleme hedefleri. Serbest yol kabul etmiyoruz. */
export const UPLOAD_SCOPES = ["product", "try-on"] as const;
export type UploadScope = (typeof UPLOAD_SCOPES)[number];

/**
 * Blob içindeki yol. Kiracı kimliğiyle başlar; böylece dosyalar kiracıya göre
 * ayrışır ve bir kiracının yüklediği başka bir kiracının alanına düşemez.
 */
export function blobPath(tenantId: string, scope: UploadScope, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
  return `${tenantId}/${scope}/${Date.now()}-${safe}`;
}
