# Bridal Stack — Kiralama / Temizleme / Tadilat (2026-09-02)

`config/modules.ts` içinde tanımlı ama sayfası olmayan son üç yol kapatıldı:
**`/rentals`**, **`/cleaning`**, **`/alterations`**. Üçü de Inventory paketinde,
menüde Returns'ün altında.

Devam ederken önce `docs/durum-2026-09-02.md`, sonra bu dosyayı oku.

---

## 1. Neden bu blok

Gelinlik dükkânında bir elbise dört yerden birinde olur: rafta, gelinin
üstünde, terzide, temizlemede. Panel bunlardan yalnız ilkini biliyordu — geri
kalan üçü ya kafada ya kâğıtta duruyordu. Artık elbisenin nerede olduğu her an
tek yerden okunuyor ve **stok bunu takip ediyor**.

---

## 2. Kapatılan gerçek boşluk

`restockUnits` eskiden `needs_cleaning` işaretli iadeyi doğrudan rafa
koyuyordu — yani kirli elbise bir sonraki geline gösterilebilir hâle geliyordu.
Artık kirli iade rafa **girmez**; iade kapanınca kendiliğinden bir temizleme işi
doğar (`return_id` tekil) ve elbise rafa ancak temizlemeden dönünce girer.

Aynısı kiralama dönüşünde de var: "Check back in" düğmesinde **Send to cleaning**
kutusu varsayılan açık.

---

## 3. Stok değişmezleri

| Olay | Rafa etkisi |
|---|---|
| Kiralama rezerve edildi | **0** — takvim kapanır, mal değil |
| Elbise gelinin eline geçti (`out`) | **−1**, ve ancak rafta varsa |
| Temiz döndü | **+1** |
| Kirli döndü | **0** — temizleme işi açılır |
| Raftan temizlemeye yollandı | **−1**, ve ancak rafta varsa |
| İade/kiradan temizlemeye düştü | **0** — mal zaten rafta değildi |
| Temizlemeden döndü | **+1**, kaynağı ne olursa olsun |
| Temizlemede hurdaya ayrıldı | **0** — bir daha dönmez |

Her yolda elbise rafa **tam bir kez** girer. Düşüm daima koşulludur
(`stock_quantity >= n`); iki sekme aynı anda gönderse bile stok eksiye kaymaz.

---

## 4. Para değişmezleri

| Kalem | Kasaya ne zaman | Tekil anahtar |
|---|---|---|
| Kira bedeli | elbise çıkarken (`out`), bir kez | `cash_movements.rental_id` |
| Teminat | **hiç** — iade edilecek tutar gelir değildir | — |
| Gecikme bedeli | otomatik **değil**; ekranda "Collect to cash" | `rentals.late_fee_collected` |
| Tadilat ücreti | yalnız **teslimde** (`delivered`) | `cash_movements.alteration_id` |
| Temizleme gideri | yalnız iş kapanınca (`returned`) | `cash_movements.cleaning_job_id` |

Gecikme bedeli tarayıcıdan gelen rakamla değil, o anki veriden yeniden
hesaplanır ve daha önce tahsil edilen düşülür — buton iki kez basılınca
ikincisinde tahsil edilecek bir şey kalmaz. Gecikme sürerse fark yeniden büyür.

"Hazır ama teslim alınmamış" tadilat para saymaz: gelin gelmeden kasada para
görünmesin.

---

## 5. Takvim

Aynı elbise çakışan tarihlerde ikinci geline verilemez. Sınırlar dahildir:
10-12 ile 12-14 çakışır — 12'sinde iki gelin de bekler. İptal edilmiş ve dönmüş
kiralamalar takvimi kapatmaz.

---

## 6. Doğrulama durumu

- **142 birim test yeşil** (`npm test`) — önceki 111'e 31 yeni kural testi.
- **Migration zinciri sıfırdan doğrulandı**: boş bir yerel Postgres'e
  `prisma migrate deploy`, ardından `migrate diff` → *No difference detected*.
- **10 veritabanı değişmezi denendi** (`tests/e2e/stage14-db.mjs`): beş mükerrer
  kayıt kilidi, koşullu stok düşümü, üç kiracı izolasyonu.
- `tsc --noEmit` hatasız, `next build` temiz, lint **0 hata** (eski uyarılar).
- Yeni sayfaların ürettiği uyarı yok.

Migration ÜRETİLİRKEN canlı veritabanına dokunulmadı — SQL elle yazıldı,
doğrulama tek kullanımlık yerel bir veritabanında yapıldı ve o veritabanı
silindi. (Bkz. önceki notun 8. bölümü: `migrate diff --shadow-database-url`
tuzağı.)

---

## 7. Ek düzeltme

`/trunk-shows` menüde vardı ama `MODULES.inventory.routes` içinde yoktu.
`isRouteAllowed` şu an hiçbir yerde çağrılmadığı için canlı bir arıza değildi;
o kapı açılırsa Trunk Shows'un kapanmaması için listeye eklendi.

---

## 8. Sırada ne var

- Satın alma siparişi (tedarikçi hâlâ bir etiket, sipariş akışı yok).
- Kalem bazlı prim — `Order` modelinde kalem yok.
- Kasa gün açılış/kapanış sayımı ve kasa farkı raporu.
- Kiralama takvimini `/calendar` üzerinde göstermek.
