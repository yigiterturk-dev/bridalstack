-- Takip listesinden elle gönderilen hatırlatma e-postalarının kaydı.
CREATE TABLE "follow_up_emails" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "product_id" UUID,
    "sent_by" UUID,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_emails_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "follow_up_emails_tenant_id_customer_id_idx" ON "follow_up_emails"("tenant_id", "customer_id");
CREATE INDEX "follow_up_emails_tenant_id_sent_at_idx" ON "follow_up_emails"("tenant_id", "sent_at");

ALTER TABLE "follow_up_emails" ADD CONSTRAINT "follow_up_emails_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follow_up_emails" ADD CONSTRAINT "follow_up_emails_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
