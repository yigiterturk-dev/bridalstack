-- AlterTable: kasa hareketine üç yeni kaynak kimliği.
-- Her biri tekildir; aynı kiralama/tadilat/temizleme iki kez kasaya yazılamaz.
ALTER TABLE "cash_movements" ADD COLUMN "rental_id" UUID;
ALTER TABLE "cash_movements" ADD COLUMN "alteration_id" UUID;
ALTER TABLE "cash_movements" ADD COLUMN "cleaning_job_id" UUID;

-- CreateTable
CREATE TABLE "rentals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "start_date" TEXT NOT NULL,
    "due_date" TEXT NOT NULL,
    "picked_up_on" TEXT,
    "returned_on" TEXT,
    "rental_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deposit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "late_fee_per_day" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "late_fee_collected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID,
    "customer_id" UUID,
    "source" TEXT NOT NULL DEFAULT 'stock',
    "return_id" UUID,
    "rental_id" UUID,
    "vendor" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_on" TEXT,
    "expected_on" TEXT,
    "returned_on" TEXT,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cleaning_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alterations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "product_id" UUID,
    "order_id" UUID,
    "kind" TEXT NOT NULL DEFAULT 'hem',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "fitting_date" TEXT,
    "promised_date" TEXT,
    "seamstress" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "delivered_at" TIMESTAMPTZ(6),

    CONSTRAINT "alterations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_rental_id_key" ON "cash_movements"("rental_id");
CREATE UNIQUE INDEX "cash_movements_alteration_id_key" ON "cash_movements"("alteration_id");
CREATE UNIQUE INDEX "cash_movements_cleaning_job_id_key" ON "cash_movements"("cleaning_job_id");

-- CreateIndex
CREATE INDEX "rentals_tenant_id_status_idx" ON "rentals"("tenant_id", "status");
CREATE INDEX "rentals_tenant_id_product_id_start_date_idx" ON "rentals"("tenant_id", "product_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "cleaning_jobs_return_id_key" ON "cleaning_jobs"("return_id");
CREATE UNIQUE INDEX "cleaning_jobs_rental_id_key" ON "cleaning_jobs"("rental_id");
CREATE INDEX "cleaning_jobs_tenant_id_status_idx" ON "cleaning_jobs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "alterations_tenant_id_status_idx" ON "alterations"("tenant_id", "status");
CREATE INDEX "alterations_tenant_id_promised_date_idx" ON "alterations"("tenant_id", "promised_date");

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_jobs" ADD CONSTRAINT "cleaning_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning_jobs" ADD CONSTRAINT "cleaning_jobs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning_jobs" ADD CONSTRAINT "cleaning_jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning_jobs" ADD CONSTRAINT "cleaning_jobs_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "product_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning_jobs" ADD CONSTRAINT "cleaning_jobs_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alterations" ADD CONSTRAINT "alterations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alterations" ADD CONSTRAINT "alterations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alterations" ADD CONSTRAINT "alterations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alterations" ADD CONSTRAINT "alterations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
