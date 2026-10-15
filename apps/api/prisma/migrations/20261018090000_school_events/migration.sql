-- Additive only: school events and PTMs for the mobile calendar.

-- CreateEnum
CREATE TYPE "SchoolEventType" AS ENUM ('EVENT', 'PTM');

-- CreateTable
CREATE TABLE "school_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "type" "SchoolEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "start_time" TEXT,
    "end_time" TEXT,
    "venue" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_events_tenant_id_start_date_idx" ON "school_events"("tenant_id", "start_date");

-- AddForeignKey
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

