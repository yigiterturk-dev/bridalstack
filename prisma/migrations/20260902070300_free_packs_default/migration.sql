-- AlterTable
ALTER TABLE "tenants" ALTER COLUMN "packs" SET DEFAULT ARRAY['base', 'salon']::TEXT[];

-- Ücretsiz "salon" paketi (online randevu + hizmetler) ücretsiz katmanın
-- parçası. Varsayılan değişikliği yalnızca YENİ kiracıları etkilediği için
-- mevcut kiracılara da elle veriyoruz.
UPDATE "tenants"
SET "packs" = array_append("packs", 'salon')
WHERE NOT ('salon' = ANY("packs"));
