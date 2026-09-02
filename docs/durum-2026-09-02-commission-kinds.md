# Bridal Stack — Kalem bazlı prim kuralları (2026-09-02)

Prim kuralı artık siparişin tamamına değil, **belirli bir kalem türüne** de
bağlanabiliyor: "elbisede %8, duvakta %3, tadilatta %50".

Sırayla oku: `durum-2026-09-02.md` → `-rentals.md` → `-purchasing.md`
→ `-order-lines.md` → bu dosya.

---

## 1. Asıl soru: toplanır mı, toplanmaz mı?

Bir kullanıcı "herkese %5" yazıp üstüne "elbisede %8" eklerse ne bekler?
**%13 değil.** Elbisenin 8, gerisinin 5 almasını bekler.

Kural bu yüzden şöyle: **en özel kural o kalemi tek başına belirler.**
Genel kural ile tür kuralı hiçbir zaman toplanmaz — tür kuralı olmayan
kalemler genel kurala düşer.

Farklı **türlerin** kuralları ise toplanır: elbise kendi kuralından, tadilat
kendi kuralından kazandırır.

---

## 2. Özgüllük merdiveni

```
tür + satışçı   >   tür   >   satışçı   >   herkes
```

Önce **öncelik** (`priority`) bakılır; eşitse bu merdiven karar verir.
"Herkese %5, elbisede %8, Ayşe'nin elbisesinde %10" yazan kullanıcı Ayşe'nin
elbisesine 10 alır.

Öncelik özgüllüğü yener — kullanıcı bilerek bir kuralı öne almışsa sözü geçer.

---

## 3. Mevcut kurallar hiç etkilenmez

`applies_to` varsayılanı `"order"`, yani migration'dan sonra bütün eski
kurallar bugüne kadarki gibi çalışır. Hesap iki yola ayrılıyor ve hangisinin
işlediği **verinin kendisinden** belli:

| Durum | Yol |
|---|---|
| Hiç tür kuralı yok | eski yol: tek kural, siparişin tamamı, yüzde + sabit |
| Siparişin kalemi yok | eski yol (tür kuralı tanımlı olsa bile) |
| Tür kuralı var **ve** kalem var | her tür kendi kuralını bulur, yüzdeler toplanır |

Migration yalnız iki sütun ekliyor, tek bir satır bile değiştirmiyor.

---

## 4. Sabit bonus sipariş başınadır

Tür kuralına sabit bonus verilemez — verilseydi bonus her türde bir kez sayılır
ve kullanıcı beklemediği bir rakam görürdü. Kural formu bunu reddediyor
(`error=kindrate`), kayıt da `flat_amount`'ı sıfırlıyor.

Karma hesapta sabit bonus yalnız **siparişin tamamına** yazılmış kuraldan,
**bir kez** eklenir.

---

## 5. Diğer değişmezler

- Alt sınır (`min_order_total`) her zaman **sipariş** toplamına bakar, kalem
  toplamına değil: "2000 altındaki siparişe prim yok" yazan kişi siparişi kasteder.
- Kalem indirimi prim tabanını düşürür — prim indirimli tutardan hesaplanır.
- İptal/taslak sipariş kalemli kuralla da prim doğurmaz.
- Ödeme kaydı sırasında tutar formdan değil o anki veriden yeniden hesaplanır
  (bu kural zaten vardı, kalem hesabı da aynı yoldan geçiyor).

---

## 6. Arayüz

- **Kural formu**: "Paid to" (kime) ve **"Earned on"** (neye) ayrı iki soru;
  ikincisi "The whole order" / "One kind of item". Tür seçilince kalem türü
  listesi kullanılır.
- **Kural listesi**: her kuralda "Whole order" veya "Gown only" rozeti.
- **Prim sayfası**: tür kuralı işlediyse sipariş satırında tek bir "uygulanan
  kural" yerine **tür tür döküm** yazılır (`Gown · Gowns 8%` / `Veil · Standard 5%`).
  Tür kuralı yoksa satır eskisi gibi tek kural gösterir.

---

## 7. Doğrulama durumu

- **185 birim test yeşil** — 171'e 14 yeni kural testi; hepsi ilk çalıştırmada geçti.
- **10 uçtan uca kontrol** (`tests/e2e/stage17-commission-kinds.mjs`): varsayılanla
  açılan eski kurallar, tür kuralı yokken değişmeyen hesap, tür kuralına geçiş,
  satışçıya özel tür kuralı, pasif kural, satışçı özetinin tutması, iptal, izolasyon.
- Migration boş yerel Postgres'e sıfırdan uygulandı, `migrate diff` → *No
  difference detected*, veritabanı silindi. Canlıya dokunulmadı.
- `tsc --noEmit` hatasız, `next build` temiz, lint **0 hata**.

---

## 8. Not: saf kütüphaneler arası import

`lib/commissions.ts` artık `lib/order-lines.ts`'ten okuyor. Saf kütüphaneler
birbirini **göreli yolla ve `.ts` uzantısıyla** çağırmalı (`./order-lines.ts`) —
`@/lib/...` takma adı Node test koşucusunda çözülmüyor ve testler
`ERR_MODULE_NOT_FOUND` ile patlıyor. `tsconfig` zaten
`allowImportingTsExtensions` açık, Next de bu yolu sorunsuz derliyor.

---

## 9. Sırada ne var

- Kasa gün açılış/kapanış sayımı ve kasa farkı raporu.
- Kiralama takvimini `/calendar` üzerinde göstermek.
- Tedarikçi sayfasına açık siparişler bölümü.
