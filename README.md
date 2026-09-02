# Bridal Stack

BridalStack, gelinlik mağazaları ve özel dikim evleri (bridal boutiques) için geliştirilmiş modüler, hepsi bir arada bir CRM ve mağaza yönetim sistemidir. 

Next.js (App Router), Supabase ve TailwindCSS kullanılarak inşa edilmiştir.

## Özellikler (Modüller)
- **Müşteri Yönetimi (CRM):** Gelin profilleri, düğün tarihleri, notlar ve prova geçmişi.
- **Randevu Sistemi:** Takvim görünümü, deneme (try-on) randevuları ve personel atamaları.
- **Satış ve Sözleşmeler:** Siparişler, kaparo takibi, taksit planları ve dijital sözleşme imzalama.
- **Finans ve Kasa:** Gelir/gider takibi, personel prim hesaplamaları (Commissions).
- **Envanter (Inventory):** Gelinlik modelleri, stok durumu ve barkodlu yönetim.
- **AI Stylist:** Mağaza içi verilere göre (ör. "Sahil düğünü için 3000$ altı modeller") yapay zeka destekli öneriler sunan asistan.

## Kurulum ve Çalıştırma

Gereksinimler: Node.js 18+ 

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat (localhost:3000)
npm run dev
```

## Mimari
- `app/(dashboard)`: Giriş yapmış kullanıcıların (mağaza sahipleri) kullandığı asıl SaaS uygulaması.
- `app/landing`: Dışarıya açık, satış ve tanıtım sayfası.
- `lib/supabase`: Veritabanı ve kimlik doğrulama işlemleri.
- `config/modules.ts`: Sistemin modüler yapısını (Hangi pakette hangi özellik var) belirleyen konfigürasyon.

## Üretim (Production)

```bash
npm run build
npm start
```
