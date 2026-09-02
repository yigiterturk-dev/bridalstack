-- AlterTable: prim kuralı artık siparişin tamamına değil, belirli bir kalem
-- türüne de bağlanabilir. Varsayılan 'order' olduğu için mevcut kuralların
-- davranışı hiç değişmez.
ALTER TABLE "commission_rules" ADD COLUMN "applies_to" TEXT NOT NULL DEFAULT 'order';
ALTER TABLE "commission_rules" ADD COLUMN "line_kind" TEXT;
