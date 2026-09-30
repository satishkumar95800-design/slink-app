-- CreateEnum
CREATE TYPE "StudentNoteType" AS ENUM ('note', 'mom', 'complaint', 'parent_discussion');

-- AlterEnum
ALTER TYPE "ReportType" ADD VALUE 'report_card';

-- CreateTable
CREATE TABLE "student_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "type" "StudentNoteType" NOT NULL DEFAULT 'note',
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_notes_tenant_id_student_id_idx" ON "student_notes"("tenant_id", "student_id");

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
