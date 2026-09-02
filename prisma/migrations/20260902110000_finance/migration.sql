-- CreateTable
CREATE TABLE "cash_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'in',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "category" TEXT NOT NULL DEFAULT 'other',
    "occurred_on" TEXT NOT NULL,
    "description" TEXT,
    "order_id" UUID,
    "customer_id" UUID,
    "installment_id" UUID,
    "check_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'received',
    "counterparty" TEXT NOT NULL,
    "bank" TEXT,
    "check_no" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "due_date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'portfolio',
    "customer_id" UUID,
    "order_id" UUID,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMPTZ(6),

    CONSTRAINT "checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_installment_id_key" ON "cash_movements"("installment_id");

-- CreateIndex
CREATE INDEX "cash_movements_tenant_id_occurred_on_idx" ON "cash_movements"("tenant_id", "occurred_on");

-- CreateIndex
CREATE INDEX "cash_movements_check_id_idx" ON "cash_movements"("check_id");

-- CreateIndex
CREATE INDEX "checks_tenant_id_status_idx" ON "checks"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "checks_tenant_id_due_date_idx" ON "checks"("tenant_id", "due_date");

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checks" ADD CONSTRAINT "checks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

