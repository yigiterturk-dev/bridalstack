# Uçtan uca testler

Bu betikler gerçek bir veritabanına ve ayakta bir sunucuya karşı çalışır.
Kayıt yazarlar, o yüzden **üretim veritabanına karşı çalıştırmayın.**

## Önkoşullar

1. **Veritabanı.** Ana veritabanı (HTTP aşamaları 1–13, 21–22, 24) ve izole bir
   veritabanı (DB aşamaları 14–20) gerekir. İzole DB boş olmalıdır:

   ```bash
   createdb bridalstack_e2e_iso
   DATABASE_URL="postgresql://$USER@localhost:5432/bridalstack_e2e_iso" \
   DIRECT_URL="$DATABASE_URL" npx prisma migrate deploy
   ```

2. **Yerel ortam değişkenleri** (`.env.local`). Uçtan uca takım tek bir dev
   sunucusuna onlarca istek atar; aşağıdaki dev-only bayraklar olmadan ürün
   hatası olmayan kırmızılar çıkar:

   ```bash
   CRON_SECRET=e2e-local-cron-secret   # cron uçları (stage3/5/10) bunu ister
   RATE_LIMIT_DISABLED=1               # in-memory sayaç 429 üretmesin
   EMAIL_DRY_RUN=1                     # e-posta sağlayıcısı olmadan gönderim yolu
   ```

   `RATE_LIMIT_DISABLED` ve `EMAIL_DRY_RUN` **yalnızca** `NODE_ENV != production`
   iken etkilidir; canlıda yok sayılır (bkz. `lib/ratelimit.ts`, `lib/email.ts`).

3. **Sunucu.** Ayrı bir terminalde:

   ```bash
   PORT=3100 npm run dev
   ```

## Çalıştırma

Hepsini sırayla koşturup tek özet almak için:

```bash
node tests/e2e/run-all.mjs                 # tüm aşamalar
node tests/e2e/run-all.mjs stage12 stage21-ai-gate   # yalnız seçilenler
```

İzole DB adresi varsayılan olarak `bridalstack_e2e_iso`'dur;
`E2E_ISO_URL=postgresql://... node tests/e2e/run-all.mjs` ile değiştirilebilir.

Tek tek çalıştırmak için (HTTP aşamaları 1→13 sırasına bağlıdır; örn. stage3,
stage2'nin kurduğu kiracıyı okur):

```bash
node tests/e2e/stage1.mjs      # kimlik doğrulama, sayfa erişimi, sahte veri kontrolü
node tests/e2e/stage2.mjs      # veri akışı, herkese açık rezervasyon, kiracı izolasyonu
node tests/e2e/stage3.mjs      # sözleşme imzalama, müşteri portalı, cron uçları
node tests/e2e/stage4.mjs      # parola sıfırlama, ekip daveti, satılamayan paketler
node tests/e2e/stage5.mjs      # taksit planı, vade durumları, tahsilat özeti
node tests/e2e/stage6.mjs      # fotoğraf yükleme, görsel gösterimi, migration sırası
node tests/e2e/stage7.mjs      # takip listesi, elbise dönüşüm oranı
node tests/e2e/stage8.mjs      # günlük brifing, sinyal önceliklendirme
node tests/e2e/stage9.mjs      # yazdırılabilir fatura ve sözleşme, erişim kontrolü
node tests/e2e/stage10.mjs     # günlük brifing e-postası, cron zamanlaması
node tests/e2e/stage11.mjs     # faturalar (alacak yaşlandırma), raporlar, CSV dışa aktarma
node tests/e2e/stage12.mjs     # kaldırılan modüller, ücretsiz katman ve deneme kapısı
node tests/e2e/stage13.mjs     # tenant izolasyonu ve rol erişimleri
node tests/e2e/stage21-ai-gate.mjs # AI Stylist paket kapısı
node tests/e2e/stage22-booking-concurrency.mjs # eşzamanlı booking kilidi, no-preference ataması ve müşteri dedupe
node tests/e2e/stage24-locations.mjs # çok şube: aktif kiracı çerezi ve üyelik doğrulaması

# İzole DB gerektirir (DATABASE_URL/DIRECT_URL = bridalstack_e2e_iso):
node tests/e2e/stage14-db.mjs  # kiralama, temizlik ve tadilat veritabanı değişmezleri
node tests/e2e/stage15-purchasing.mjs # satın alma, stok ve kasa değişmezleri
node tests/e2e/stage16-order-lines.mjs # sipariş kalemleri ve toplamlar
node tests/e2e/stage17-commission-kinds.mjs # kalem bazlı prim kuralları
node tests/e2e/stage18-cash-sessions.mjs # kasa oturumları ve farklar
node tests/e2e/stage19-calendar-suppliers.mjs # takvim ve tedarikçi akışları
node tests/e2e/stage20-trial-demo.mjs # deneme okuma kapısı ve tanıtım verisi silme
node tests/e2e/stage23-account.mjs # veri dışa aktarma ve hesap silme (cascade)
```

Betikler `@prisma/client`'ı çözebilmek için proje kökünden çalıştırılmalı.
Her aşama geçen ve kalan kontrol sayısını basar, hata varsa sıfırdan farklı çıkar.

## Notlar

- **Deneme (trial).** Kayıt, kiracıya satılabilir tüm ücretli paketlerde deneme
  açar (`settings.trial_packs`); modüller yalnızca `trial_ends_at` gelecekteyken
  okuma anında açılır. Modül kapısını sınayan aşamalar (1, 4, 11, 12, 13, 21)
  önce `trial_ends_at`'i geçmişe çekip kapının kapandığını doğrular.
- **Hız sınırı.** `rateLimit` Upstash yapılandırılmamışsa in-memory çalışır ve
  tüm aşamalar aynı dev sürecini paylaştığından sayaç birikir. Yerelde
  `RATE_LIMIT_DISABLED=1` bunu devre dışı bırakır.
