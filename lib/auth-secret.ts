/**
 * Oturum jetonlarını imzalayan gizli anahtar.
 *
 * Üretimde NEXTAUTH_SECRET tanımlı olmak ZORUNDA. Depoya gömülü sabit bir
 * varsayılana düşmek, kaynağı gören herkesin geçerli oturum jetonu üretebilmesi
 * demektir; bu yüzden üretimde sessizce devam etmek yerine açılışta hata veriyoruz.
 */
export function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret) return secret;

  // `next build` sunucu modüllerini yüklerken env dosyası yoktur. Derleme
  // sırasında patlamak, gizli anahtar gerektirmeyen bir build'i imkânsız
  // kılıyordu (CI tam olarak burada düşüyordu). Çalışma anında NEXT_PHASE
  // yoktur; orada hâlâ fail-closed.
  if (process.env.NEXT_PHASE === "phase-production-build") return "build-only-insecure-secret";

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXTAUTH_SECRET is not set. Generate one with `openssl rand -base64 32` and set it before starting the server."
    );
  }

  return "dev-only-insecure-secret";
}
