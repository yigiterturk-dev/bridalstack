# Bridal Stack — Kiralama takvimi ve tedarikçi açık siparişleri (2026-09-02)

Backlog'un son iki maddesi. Şema değişmedi; ikisi de mevcut veriyi doğru yerde
göstermekle ilgili.

Sırayla oku: `durum-2026-09-02.md` → `-rentals.md` → `-purchasing.md`
→ `-order-lines.md` → `-commission-kinds.md` → `-cash-sessions.md` → bu dosya.

---

## 1. Kiralama takvimi — asıl zorluk

**Randevu bir ANdır, kiralama bir ARALIKtır.** Aralığı takvime olduğu gibi
dökersek on günlük tek bir kiralama on günü doldurur ve randevular gözden
kaybolur.

Bu yüzden bir kiralama, düştüğü her gün için bir **rol** üretiyor:

| Rol | Anlamı | Takvimde |
|---|---|---|
| `pickup` | elbise o gün dükkândan çıkıyor | ↑ gelin adı |
| `due` | elbise o gün dönecek | ↓ gelin adı |
| `out` | o gün zaten gelinin elinde | tek satır: "3 out" |

Eyleme geçilecek iki gün (çıkış ve dönüş) hücrenin başında, adıyla duruyor.
Arada kalan günler tek bir sayıya iniyor — bilgi kayboluyor değil, gürültü
kayboluyor.

Geciken kiralama (dönüş günü geçmiş ve hâlâ dışarıda) kırmızı.

---

## 2. Ay sınırı

Ağustosta çıkıp eylülde dönen bir kiralama, eylül takviminde 1'inden itibaren
`out` olarak başlıyor ve dönüş günü `due` işaretleniyor — çıkış günü başka ayda
olduğu için eylülde `pickup` görünmüyor. Sorgu da aya **değen** her kiralamayı
alıyor (`start_date <= ayın sonu AND due_date >= ayın başı`), yalnız ay içinde
başlayanları değil.

İptal edilmiş ve dönmüş kiralamalar takvimde hiç yer kaplamıyor.

---

## 3. Paket sınırı

Takvim `appointments` modülünde, kiralamalar `inventory` modülünde. Sayfa
kiralamaları **yalnız Inventory paketi açıksa** okuyor: takvimin açık olması
envanteri açmaz. Base paketli bir kiracı takvimde kiralama görmez.

---

## 4. Tedarikçi açık siparişleri

Tedarikçi kartında artık "On order" bölümü var: kaç elbise yolda, parası ne
kadar, kaç sipariş gecikti. Her sipariş `PO260902-XXXX · 2/5` rozetiyle
siparişin kendi sayfasına bağlanıyor.

İki şey bilerek dışarıda:

- **Taslak siparişler sayılmıyor.** Tedarikçi onlardan haberdar değil; "yolda"
  demek yanlış olurdu.
- **Kapanmış siparişler sayılmıyor.** Yolda olan, henüz gelmemiş olandır.

Yolda kalan adet ve para, sipariş edilenden **fiilen teslim alınan** düşülerek
hesaplanıyor: 5 sipariş edilip 2'si gelmişse yolda 3 elbise ve 3 elbisenin
parası var.

---

## 5. Küçük düzeltme

Takvimde "+N daha" yazan tek bir Türkçe dize kalmıştı; arayüzün geri kalanı
İngilizce. "+N more" oldu.

---

## 6. Doğrulama durumu

- **215 birim test yeşil** — 204'e 11 yeni takvim kuralı testi (ay uzunluğu,
  roller, ay taşması, ters aralık, sıralama).
- **14 uçtan uca kontrol** (`tests/e2e/stage19-calendar-suppliers.mjs`): aya
  değen/değmeyen kiralamaları seçen sorgu, sarkan kiralamanın rolleri, taslak ve
  kapanmış siparişin "yolda" sayılmaması, yolda kalan adet ve para, gecikme.
- Şema değişmediği için migration yok; sorgular yine de boş bir yerel
  veritabanında çalıştırıldı ve veritabanı silindi. Canlıya dokunulmadı.
- `tsc --noEmit` hatasız, `next build` temiz, lint **0 hata**.

---

## 7. Backlog bitti

Bu turla birlikte listedeki beş işin hepsi kapandı:

1. ✅ `Order` modeline kalem
2. ✅ Kalem bazlı prim kuralları
3. ✅ Kasa gün açılış/kapanış sayımı ve fark raporu
4. ✅ Kiralama takvimi
5. ✅ Tedarikçi açık siparişleri

Yayın için kalanlar hâlâ Yiğit'te: Stripe fiyatları, Vercel env'leri,
Neon'un us-east'e taşınması, fotoğraf için S3/R2 kararı.
