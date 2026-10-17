-- CreateEnum
CREATE TYPE "CircularAudience" AS ENUM ('staff', 'staff_and_parents');

-- CreateEnum
CREATE TYPE "AdmissionStage" AS ENUM ('enquiry', 'campus_tour', 'follow_up', 'registration', 'enrolled', 'lost');

-- CreateEnum
CREATE TYPE "AdmissionSource" AS ENUM ('walk_in', 'phone', 'website', 'referral', 'social_media', 'other');

-- AlterTable
ALTER TABLE "school_groups" ADD COLUMN     "attendance_cutoff" TEXT NOT NULL DEFAULT '10:00';

-- CreateTable
CREATE TABLE "group_circulars" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "CircularAudience" NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_circulars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_circular_branches" (
    "circular_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_count" INTEGER NOT NULL DEFAULT 0,
    "parent_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "group_circular_branches_pkey" PRIMARY KEY ("circular_id","tenant_id")
);

-- CreateTable
CREATE TABLE "admission_enquiries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "child_name" TEXT NOT NULL,
    "dob" DATE,
    "class_sought" TEXT,
    "parent_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "source" "AdmissionSource" NOT NULL,
    "stage" "AdmissionStage" NOT NULL DEFAULT 'enquiry',
    "tour_on" DATE,
    "next_follow_up_on" DATE,
    "lost_reason" TEXT,
    "notes" TEXT,
    "assigned_to" UUID,
    "created_by" UUID NOT NULL,
    "stage_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "from_stage" "AdmissionStage",
    "to_stage" "AdmissionStage",
    "note" TEXT,
    "by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_circulars_group_id_created_at_idx" ON "group_circulars"("group_id", "created_at");

-- CreateIndex
CREATE INDEX "group_circular_branches_tenant_id_idx" ON "group_circular_branches"("tenant_id");

-- CreateIndex
CREATE INDEX "admission_enquiries_tenant_id_stage_idx" ON "admission_enquiries"("tenant_id", "stage");

-- CreateIndex
CREATE INDEX "admission_enquiries_tenant_id_created_at_idx" ON "admission_enquiries"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "admission_enquiries_tenant_id_next_follow_up_on_idx" ON "admission_enquiries"("tenant_id", "next_follow_up_on");

-- CreateIndex
CREATE INDEX "admission_activities_enquiry_id_created_at_idx" ON "admission_activities"("enquiry_id", "created_at");

-- AddForeignKey
ALTER TABLE "group_circulars" ADD CONSTRAINT "group_circulars_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "school_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_circular_branches" ADD CONSTRAINT "group_circular_branches_circular_id_fkey" FOREIGN KEY ("circular_id") REFERENCES "group_circulars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_circular_branches" ADD CONSTRAINT "group_circular_branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_enquiries" ADD CONSTRAINT "admission_enquiries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_activities" ADD CONSTRAINT "admission_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_activities" ADD CONSTRAINT "admission_activities_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "admission_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The admissions pipeline is part of Premium and Premium Max.
UPDATE "tenants"
SET "features" = COALESCE("features", '{}'::jsonb) || '{"admissions":true}'::jsonb
WHERE "subscription_plan" IN ('premium', 'premium_max');
