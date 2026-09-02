-- CreateTable
CREATE TABLE "commission_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'all',
    "staff_name" TEXT,
    "rate_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flat_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "min_order_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_payouts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_name" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "paid_by" UUID,
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commission_rules_tenant_id_is_active_idx" ON "commission_rules"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "commission_payouts_tenant_id_period_idx" ON "commission_payouts"("tenant_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "commission_payouts_tenant_id_staff_name_period_key" ON "commission_payouts"("tenant_id", "staff_name", "period");

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

