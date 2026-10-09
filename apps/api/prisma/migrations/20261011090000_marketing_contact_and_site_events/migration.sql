-- Phase 5 (docs/SPEC-improvements.md): additive only — contact_requests and
-- site_event_counts (daily aggregate counts, no personal data).

-- CreateTable
CREATE TABLE "contact_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "school_name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "student_count" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "preferred_time" TEXT,
    "emailed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_event_counts" (
    "day" DATE NOT NULL,
    "event" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "site_event_counts_pkey" PRIMARY KEY ("day","event","path")
);

-- CreateIndex
CREATE INDEX "contact_requests_created_at_idx" ON "contact_requests"("created_at");

