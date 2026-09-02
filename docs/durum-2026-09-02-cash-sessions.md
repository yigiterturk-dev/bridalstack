# Bridal Stack — Kasa gün açılış/kapanış sayımı (2026-09-02)

Kasa sayfası gün içindeki hareketleri gösteriyordu ama **çekmecedeki paranın
tutup tutmadığını kimse sormuyordu**. Artık gün açılıyor, akşam sayılıyor ve
fark kayda geçiyor.

Sırayla oku: `durum-2026-09-02.md` → `-rentals.md` → `-purchasing.md`
→ `-order-lines.md` → `-commission-kinds.md` → bu dosya.

---

## 1. Tek değişmez: çekmecede sadece nakit vardır

Kartla, havaleyle veya çekle geçen para **hiç çekmeceye girmez** ve gün sonu
sayımına karışmaz. 3000 dolarlık kart tahsilatı yapılan bir günde çekmecede
o para aranmaz.

```
beklenen kapanış = açılış parası + (o günün NAKİT girişleri − nakit çıkışları)
```

`groupByMethod` zaten "in the drawer" satırını nakitle sınırlıyordu; sayım da
aynı kuralı tek bir yerden (`lib/cash-session.ts`) okuyor.

---

## 2. En kritik kural: beklenen tutar kapanışta DONDURULUR

Kapanış anında hesaplanan beklenti `expected_close` alanına yazılıyor. O güne
**sonradan geriye dönük bir hareket girilse bile geçmiş sayımın farkı
değişmez.**

Bu olmasaydı: 2 Eylül akşamı kasa tam tutar, üç gün sonra birisi o güne
unuttuğu 5000'lik bir tahsilatı girer ve geçmişteki "tuttu" kaydı sessizce
"5000 eksik"e dönerdi. Kimsenin haberi olmadan geçmiş değişmiş olurdu.

Stok sayımındaki "beklenen adet dondurulur" kuralının aynısı — panelde artık
iki yerde de aynı prensip işliyor.

Açık oturumda beklenti anlık hesaplanır; ancak kapanınca donar.

---

## 3. Fark

`fark = sayılan − beklenen`. Artı ise kasada fazla, eksi ise eksik var.

Fark isteğe bağlı olarak deftere yazılır (varsayılan açık):
**eksik para bir giderdir, fazla para bir gelirdir.** Böylece defter
çekmecenin gerçeğiyle uyuşur.

- Tutar formdan gelmez, kapanış anındaki veriden yeniden hesaplanır.
- Tekil anahtar `cash_movements.cash_session_id` — aynı farkın ikinci kez
  yazılması veritabanı seviyesinde imkânsız.
- Tam tutan sayım hiç kayıt doğurmaz.

---

## 4. Diğer kurallar

- Aynı kiracıda aynı gün için **tek oturum** açılır
  (`@@unique([tenant_id, business_date])`). Farklı kiracılar aynı günü ayrı ayrı açar.
- Kapanmış oturum yeniden kapatılamaz — güncelleme "hâlâ açık" şartıyla yazılır,
  iki sekme aynı anda kapatırsa ikincisi hiçbir şey değiştirmez.
- Yeni gün **dünkü sayımla** açılır; açılış parası boş bırakılırsa devir gelir.
  Dünkü oturum yoksa ya da sayılmamışsa sıfırdan başlanır. Eksi sayım devre
  taşınmaz.

---

## 5. Kasa farkı raporu

Defter sayfasına (`/ledger`) aylık **Till counts** bölümü eklendi: kaç gün
sayıldı, kaçı tam tuttu, kaç gün fazla/eksik çıktı, net fark ne.

İki rakam ayrı duruyor çünkü biri diğerini gizler:

- **Net fark** — yönler birbirini götürür.
- **Toplam sapma** — götürmez. Bir gün 20 eksik, ertesi gün 20 fazla çıkan bir
  kasanın neti sıfırdır ama o kasa düzgün çalışmıyordur. İkisi farklıysa sayfa
  bunu ayrıca yazıyor.

En büyük sapmanın hangi gün olduğu da gösteriliyor. Rapor kapanmış oturumların
dondurulmuş değerlerini okur — geçmişe bakar ve geçmiş bir daha değişmez.

---

## 6. Doğrulama durumu

- **204 birim test yeşil** — 185'e 19 yeni sayım kuralı testi.
- **13 uçtan uca kontrol** (`tests/e2e/stage18-cash-sessions.mjs`): kartın
  çekmeceye girmemesi, çift oturum engeli, dondurma, geriye dönük hareketin
  geçmişi değiştirmemesi, tekil fark kaydı, çifte kapatma, devir, izolasyon.
- Migration boş yerel Postgres'e sıfırdan uygulandı, `migrate diff` → *No
  difference detected*, veritabanı silindi. Canlıya dokunulmadı.
- `tsc --noEmit` hatasız, `next build` temiz, lint **0 hata**.

---

## 7. Sırada ne var

- Kiralama takvimini `/calendar` üzerinde göstermek.
- Tedarikçi sayfasına açık siparişler bölümü.
