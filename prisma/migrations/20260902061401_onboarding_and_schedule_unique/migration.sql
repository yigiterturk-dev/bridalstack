-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "onboarding_completed_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "staff_schedules_member_id_day_of_week_key" ON "staff_schedules"("member_id", "day_of_week");

