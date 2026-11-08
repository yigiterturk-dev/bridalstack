-- Patronun ekip üyesi başına kapattığı bölümler (modül kimlikleri + "analytics").
-- Boş liste = her şey açık (eski davranış).
ALTER TABLE "tenant_members" ADD COLUMN "hidden_modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
