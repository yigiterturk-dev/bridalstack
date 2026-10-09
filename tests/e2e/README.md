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
node tests/e2e/stage11.mjs     # faturalar (alacak yaşlandırma), raporlar, CSV dışa aktarma
node tests/e2e/stage12.mjs     # kaldırılan modüller, ücretsiz katman paketleri
node tests/e2e/stage13.mjs     # tenant izolasyonu ve rol erişimleri
node tests/e2e/stage14-db.mjs  # kiralama, temizlik ve tadilat veritabanı değişmezleri (izole DB)
node tests/e2e/stage15-purchasing.mjs # satın alma, stok ve kasa değişmezleri (izole DB)
node tests/e2e/stage16-order-lines.mjs # sipariş kalemleri ve toplamlar (izole DB)
node tests/e2e/stage17-commission-kinds.mjs # kalem bazlı prim kuralları (izole DB)
node tests/e2e/stage18-cash-sessions.mjs # kasa oturumları ve farklar (izole DB)
node tests/e2e/stage19-calendar-suppliers.mjs # takvim ve tedarikçi akışları (izole DB)
node tests/e2e/stage20-trial-demo.mjs # trial kapısı ve demo verisi (izole DB)
node tests/e2e/stage21-ai-gate.mjs # AI Stylist paket kapısı
```

Betikler `@prisma/client`'ı çözebilmek için proje kökünden çalıştırılmalı.
Her aşama geçen ve kalan kontrol sayısını basar, hata varsa sıfırdan farklı çıkar.
