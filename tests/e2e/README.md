# Uçtan uca testler

Bu betikler gerçek bir veritabanına ve ayakta bir sunucuya karşı çalışır.
Kayıt yazarlar, o yüzden **üretim veritabanına karşı çalıştırmayın.**

```bash
PORT=3100 npm run dev          # ayrı bir terminalde
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
```

Betikler `@prisma/client`'ı çözebilmek için proje kökünden çalıştırılmalı.
Her aşama geçen ve kalan kontrol sayısını basar, hata varsa sıfırdan farklı çıkar.
