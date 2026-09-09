# 2026-09-09 — Funnel düzeltmesi: self-serve kayıt gerçekten erişilebilir oldu

Bulgu: `/api/auth/register` uzun süredir tam çalışır durumdaydı (user + tenant +
FREE packs + membership), ama landing'in tüm CTA'ları `/dashboard`'a (login duvarı)
gidiyordu. Ziyaretçi ürünü görebiliyordu, hesap açamıyordu.

Yapılanlar:
1. **`/signup` sayfası** — login sayfasındaki signup modunun ayrılmış hali.
   Kayıt → otomatik sign-in → `/dashboard`. Başarısız olursa `/login`'e bırakır.
2. **`lib/register.ts`** (saf, testli): e-posta biçimi, şifre ≥ 8, butik adı 2–80,
   slug üretimi (`elegance-bridal`, `elegance-bridal-2`, ...). 7 yeni test → 222.
3. **`app/api/auth/register`** sertleştirildi: doğrulama + slug çakışması
   (önceden ikinci "Elegance Bridal" UNIQUE hatasıyla patlardı) + IP başına 10
   kayıt/saat hız sınırı.
4. **Landing CTA'ları** artık `/signup`'a gidiyor; "14-day free trial" vaadi
   gerçeğe çevrildi: "Free plan · customers & appointments included".

Bilinçli kalanlar: Stripe henüz yok (ücretsiz plan funnel'ı Stripe'sız çalışır;
paid modüller sonradan) · `NEXTAUTH_URL` domain DNS'e bağlanınca set edilecek ·
Hostinger DNS (A + CNAME) bekliyor.
