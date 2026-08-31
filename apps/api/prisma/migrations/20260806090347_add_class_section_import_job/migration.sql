-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('pending', 'validating', 'validated', 'processing', 'completed', 'failed');

-- DropIndex
DROP INDEX "classes_tenant_id_name_academic_year_key";

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "section" TEXT;

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "initiated_by" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'pending',
    "summary" JSONB,
    "error_report" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_jobs_tenant_id_idx" ON "import_jobs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "classes_tenant_id_name_section_academic_year_key" ON "classes"("tenant_id", "name", "section", "academic_year");

-- CreateIndex
CREATE UNIQUE INDEX "fee_structures_tenant_id_class_id_name_academic_year_key" ON "fee_structures"("tenant_id", "class_id", "name", "academic_year");

