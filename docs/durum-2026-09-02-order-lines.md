# Bridal Stack — Sipariş kalemleri (2026-09-02)

`Order` modelinde kalem yoktu: sipariş tek bir toplam tutardı, içinde hangi
elbise, duvak veya tadilat olduğu bilinmiyordu. **En büyük yapısal eksik buydu**;
kalem bazlı prim de bunu bekliyordu.

Sırayla oku: `durum-2026-09-02.md` → `-rentals.md` → `-purchasing.md` → bu dosya.

---

## 1. Riski nasıl sıfırladım

`discounted_total` alanını **17 dosya** okuyor: faturalar, raporlar, primler,
müşteri portalı, yazdırma, panel, analiz, taksitler, tahsilat. Bu alanı
kaldırmak veya anlamını değiştirmek hepsini birden kırardı.

Bu yüzden alanı **hiç ellemedim**. Para hâlâ tek yerden okunuyor; kalemler
sadece o alanı **besliyor**:

```
kalemler ──► syncOrderTotals ──► order.list_total / discounted_total
                                        │
                                        └──► geri kalan 17 dosya (değişmedi)
```

Aşağı akıştaki hiçbir dosyaya dokunulmadı.

---

## 2. Eski siparişler bozulmaz

**Kalemi olmayan sipariş elle girilen toplamıyla aynen çalışır.**
`derivedOrderTotals` kalem yoksa `null` döner, çağıran hiçbir şey yazmaz.

| Sipariş | Davranış |
|---|---|
| Kalemsiz (eski kayıtlar) | tutar olduğu gibi kalır — kalem özelliği açıldı diye sıfırlanmaz |
| İlk kalem eklendi | toplamı kalemler devralır |
| Kalem silindi | toplam kalanlardan yeniden hesaplanır |
| Son kalem de silindi | son hesaplanan tutar durur, eski elle girilen değere DÖNMEZ |

Migration veri taşımıyor, geriye dönük hesaplama yapmıyor — yalnız yeni tablo
açıyor. Mevcut tek bir satır bile değişmiyor.

---

## 3. Para değişmezleri

- Toplam **ekrandan gelmez**, kalemlerden hesaplanır. Kalem her değiştiğinde
  `syncOrderTotals` çalışır; toplam başka hiçbir yerde yazılmaz.
- **İndirim kalemin kendisinden büyük olamaz.** Satır sıfırda durur, eksiye
  düşüp diğer kalemlerin parasını yemez.
- Eksi adet ve eksi fiyat sıfır sayılır.
- Bakiye = toplam − kapora − ödenmiş taksitler, eksiye inmez.
- Kuruşlar her adımda yuvarlanır; kayan nokta artığı toplama taşmaz
  (`0.1 + 0.1 + 0.1 + 0.2 = 0.5`, `0.5000000000000001` değil).

---

## 4. Kalem yapısı

`gown · veil · accessory · alteration · service · other`

- Ürün **isteğe bağlı**: katalogda olmayan kalem de yazılır (tadilat, hizmet).
- Ad kalemde saklanır — **ürün silinse bile sipariş okunur kalır** ve tutarı
  değişmez (`onDelete: SetNull`).
- Fiyat boş bırakılırsa ürünün katalog fiyatı gelir.
- `totalsByKind` tür bazında kırılım verir — **kalem bazlı prim bunu okuyacak**
  (sıradaki iş).

---

## 5. Arayüz

- **Sipariş sayfası**: "Items" bölümü — kalem tablosu, ara toplam / indirim /
  toplam satırları ve kalem ekleme formu. İptal edilmiş siparişin kalemleri
  değişmez. Sayfanın kendi gri stiliyle yazıldı, panelin geri kalanı gibi.
- **Yazdırılan fatura**: kalem varsa artık kalemli döküm basıyor; indirim varsa
  ara toplam ve indirim satırı da çıkıyor. Kalemsiz siparişin faturası eskisi
  gibi.

---

## 6. Doğrulama durumu

- **171 birim test yeşil** — 158'e 13 yeni kalem/toplam kuralı testi.
- **13 uçtan uca kontrol** (`tests/e2e/stage16-order-lines.mjs`): eski siparişin
  bozulmaması, ilk kalemde devralma, indirim tavanı, taksit ve fazla tahsilat,
  kalem silme, sipariş silinince kalemlerin gitmesi, ürün silinince kalemin
  okunur kalması, kiracı izolasyonu.
- Migration boş yerel Postgres'e sıfırdan uygulandı, `migrate diff` → *No
  difference detected*, veritabanı silindi. Canlıya dokunulmadı.
- `tsc --noEmit` hatasız, `next build` temiz, lint **0 hata**; app kodunda yeni
  uyarı yok.

---

## 7. Sırada ne var

- **Kalem bazlı prim kuralları** — `totalsByKind` hazır, `CommissionRule`'a
  kapsam alanı eklenecek (şu an kural sipariş toplamı üzerinden çalışıyor).
- Kasa gün açılış/kapanış sayımı ve kasa farkı raporu.
- Kiralama takvimini `/calendar` üzerinde göstermek.
- Tedarikçi sayfasına açık siparişler bölümü.
- `/orders/new` hâlâ tek toplam soruyor; sipariş kurulurken kalem girme
  istenirse ayrı bir tur.
