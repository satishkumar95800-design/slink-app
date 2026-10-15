-- Additive only: per-class bell schedules, teachers' class-reminder setting, and
-- the sent log that keeps each class reminder to one push. No existing table changes.

-- CreateTable
CREATE TABLE "class_period_timings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "period_number" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_period_timings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_reminder_settings" (
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "minutes_before" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_reminder_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "class_reminders_sent" (
    "slot_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_reminders_sent_pkey" PRIMARY KEY ("slot_id","date")
);

-- CreateIndex
CREATE INDEX "class_period_timings_tenant_id_idx" ON "class_period_timings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_period_timings_class_id_period_number_key" ON "class_period_timings"("class_id", "period_number");

-- CreateIndex
CREATE INDEX "class_reminder_settings_tenant_id_idx" ON "class_reminder_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "class_period_timings" ADD CONSTRAINT "class_period_timings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_period_timings" ADD CONSTRAINT "class_period_timings_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_reminder_settings" ADD CONSTRAINT "class_reminder_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_reminder_settings" ADD CONSTRAINT "class_reminder_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

