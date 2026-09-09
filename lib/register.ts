/**
 * Kayıt doğrulama + slug üretimi — SAF (dosya sistemi, ağ, veritabanı yok).
 * Test: tests/register.test.ts
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type RegistrationInput = { email?: unknown; password?: unknown; shopName?: unknown };
export type RegistrationResult =
  | { ok: true; email: string; password: string; shopName: string }
  | { ok: false; error: string };

/** Public signup doğrulaması. Hata mesajları İngilizce (landing dili). */
export function validateRegistration(input: RegistrationInput): RegistrationResult {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const shopName = typeof input.shopName === "string" ? input.shopName.trim() : "";

  if (!email || !EMAIL_RE.test(email) || email.length > 200) {
    return { ok: false, error: "A valid email address is required" };
  }
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters" };
  if (password.length > 200) return { ok: false, error: "Password is too long" };
  if (shopName.length < 2 || shopName.length > 80) {
    return { ok: false, error: "Boutique name must be 2-80 characters" };
  }
  return { ok: true, email, password, shopName };
}

/** "Elegance Bridal!" → "elegance-bridal" (boşsa "shop"). */
export function slugBase(shopName: string): string {
  const s = shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return s || "shop";
}

/**
 * base, base-2, base-3, ... ilk boş olanı döndürür (50 tur sonra zaman damgalı
 * kaçış). `isTaken` veritabanı sorgusu; saf fonksiyon test edilebilir.
 */
export function pickUniqueSlug(shopName: string, isTaken: (slug: string) => boolean): string {
  const base = slugBase(shopName);
  if (!isTaken(base)) return base;
  for (let i = 2; i <= 50; i += 1) {
    const candidate = `${base}-${i}`;
    if (!isTaken(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
