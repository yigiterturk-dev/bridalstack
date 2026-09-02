# Bridal Stack — Satın alma siparişi (2026-09-02)

Envanterin **giriş** tarafı açıldı: `/purchase-orders` ve `/purchase-orders/[id]`.

Sırayla oku: `docs/durum-2026-09-02.md` → `-rentals.md` → bu dosya.

---

## 1. Neden bu blok

Stok panele iki yoldan giriyordu: elle ürün düzenleyerek, ya da sayım kapatarak.
Yani **mal alımının kaydı yoktu**. Tedarikçi de sadece bir etiketti — adı,
telefonu, teslim süresi duruyordu ama hiçbir şeye bağlanmıyordu.

Artık zincir kapalı: tedarikçi → sipariş → mal kabulü → raf → kasa.

---

## 2. Akış

```
draft ──► ordered ──► partial ──► received
  │          │           │
  └──────────┴───────────┴──► cancelled  (yalnız hiç mal girmediyse)
```

- **draft** — kalemler eklenir/çıkarılır. Sipariş boşken tedarikçiye gönderilemez.
- **ordered** — kalemler **dondurulur**. Yola çıkmış siparişin içeriği değişmez.
- **partial / received** — durum **elle seçilmez, kalemlerden okunur**
  (`statusAfterReceipt`). Ekranla veri asla ayrışmaz.
- Eksik gelen sipariş **Close short** ile kapatılır; bedel yalnız fiilen gelen
  mal için yazılır.

---

## 3. Stok değişmezi

**Stok yalnız mal teslim alınırken ve yalnız ARADAKİ FARK kadar artar.**

Mal kabul ekranında adet değil, **bugüne dek toplam kaç adet geldiği** yazılır.
Bunun üç sonucu var:

| Durum | Sonuç |
|---|---|
| Sipariş verildi | raf değişmez — sipariş vermek malı getirmez |
| 3 sipariş, 1 geldi | raf +1 |
| Aynı form ikinci kez gönderildi | raf **değişmez** (fark 0) |
| 3 sipariş, 99 yazıldı | raf 3'te durur — tedarikçi söz verdiği kadarını doldurur |
| Adet geri alınmaya çalışıldı | reddedilir; gelen mal kaydı silinmez |

Yazma koşulludur (`received_qty` o an okunan değere eşitse): iki sekme aynı anda
gönderirse ikincisi hiçbir şey yazmaz.

---

## 4. Para değişmezi

**Sipariş vermek para harcamak değildir.** Mal bedeli kasaya yalnız sipariş
kapanınca, yalnız bir kez ve yalnız **fiilen teslim alınan** mal için yazılır.

- Tekil anahtar: `cash_movements.purchase_order_id`
- Yön `out`, kategori `stock`, yöntem `transfer`
- Tutar `Σ received_qty × unit_cost` — sipariş edilenin değil, gelenin maliyeti

Ürünün `cost` alanına **dokunulmaz**. Alım fiyatı değişince geçmiş kâr marjını
geriye dönük bozmamak için bilerek böyle; istenirse ayrı bir karar olarak eklenir.

---

## 5. Küçük şeyler

- Beklenen tarih boş bırakılırsa tedarikçinin `lead_time_days` alanından doldurulur.
- Kalem birim maliyeti boş bırakılırsa ürünün kayıtlı `cost` değeri kullanılır.
- Aynı ürün siparişe ikinci kez eklenirse yeni satır açılmaz, adedi artar
  (`@@unique([po_id, product_id])`).
- Tedarikçi yoksa sayfa sipariş formu yerine "önce tedarikçi ekle" der.

---

## 6. Doğrulama durumu

- **158 birim test yeşil** (`npm test`) — 142'ye 16 yeni satın alma kuralı testi.
- **Migration zinciri sıfırdan doğrulandı** — boş yerel Postgres'e
  `migrate deploy`, ardından `migrate diff` → *No difference detected*.
- **16 uçtan uca kontrol** (`tests/e2e/stage15-purchasing.mjs`): kısmi kabul,
  mükerrer gönderim, tavan aşımı, kapanışta tek kasa kaydı ve tutarı, tekil
  anahtar kilitleri, kiracı izolasyonu.
- `tsc --noEmit` hatasız, `next build` temiz, lint **0 hata**; yeni dosyalardan
  uyarı yok.

Canlı veritabanına dokunulmadı; doğrulama tek kullanımlık yerel bir
veritabanında yapıldı ve o veritabanı silindi.

---

## 7. Sırada ne var

- `Order` modelinde **kalem yok** — kalem bazlı prim bunu bekliyor. En büyük
  yapısal eksik artık bu.
- Kasa gün açılış/kapanış sayımı ve kasa farkı raporu.
- Kiralama takvimini `/calendar` üzerinde göstermek.
- Tedarikçi sayfasında "açık siparişler" bölümü.
