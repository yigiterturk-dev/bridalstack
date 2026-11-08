-- Varsayılan vurgu rengi markanın altını. Eski varsayılan mavi (#2563EB) hiçbir
-- butiğin seçimi değildi: ayar formu boş alanı bu değerle dolduruyordu.
ALTER TABLE "tenants" ALTER COLUMN "accent_color" SET DEFAULT '#8a6a3f';
UPDATE "tenants" SET "accent_color" = '#8a6a3f' WHERE upper("accent_color") = '#2563EB';
