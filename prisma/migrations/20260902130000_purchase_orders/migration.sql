-- AlterTable: mal bedeli kasaya bir kez yazılsın diye tekil kaynak kimliği.
ALTER TABLE "cash_movements" ADD COLUMN "purchase_order_id" UUID;

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "ref_no" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "expected_on" TEXT,
    "ordered_on" TEXT,
    "closed_on" TEXT,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "ordered_qty" INTEGER NOT NULL DEFAULT 1,
    "received_qty" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_purchase_order_id_key" ON "cash_movements"("purchase_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenant_id_ref_no_key" ON "purchase_orders"("tenant_id", "ref_no");
CREATE INDEX "purchase_orders_tenant_id_status_idx" ON "purchase_orders"("tenant_id", "status");
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_lines_po_id_product_id_key" ON "purchase_order_lines"("po_id", "product_id");
CREATE INDEX "purchase_order_lines_po_id_idx" ON "purchase_order_lines"("po_id");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
