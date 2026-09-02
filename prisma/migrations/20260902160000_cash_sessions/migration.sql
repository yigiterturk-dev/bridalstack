-- AlterTable: sayım farkı kasaya bir kez yazılsın diye tekil kaynak kimliği.
ALTER TABLE "cash_movements" ADD COLUMN "cash_session_id" UUID;

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "business_date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "opening_float" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "counted_close" DOUBLE PRECISION,
    "expected_close" DOUBLE PRECISION,
    "notes" TEXT,
    "opened_by" UUID,
    "closed_by" UUID,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_cash_session_id_key" ON "cash_movements"("cash_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_sessions_tenant_id_business_date_key" ON "cash_sessions"("tenant_id", "business_date");
CREATE INDEX "cash_sessions_tenant_id_status_idx" ON "cash_sessions"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
