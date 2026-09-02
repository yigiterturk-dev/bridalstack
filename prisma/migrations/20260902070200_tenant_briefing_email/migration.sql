-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "briefing_emails" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "briefing_sent_on" TEXT;
