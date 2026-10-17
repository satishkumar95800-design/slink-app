-- CreateTable
CREATE TABLE "syllabus_topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "unit" TEXT,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "planned_by" DATE NOT NULL,
    "completed_on" DATE,
    "completed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabus_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "syllabus_topics_tenant_id_class_id_subject_id_sort_order_idx" ON "syllabus_topics"("tenant_id", "class_id", "subject_id", "sort_order");

-- AddForeignKey
ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Syllabus progress is part of Premium and Gold. Schools that already have
-- every Premium module get it, so they keep matching their plan preset.
UPDATE "tenants"
SET "features" = COALESCE("features", '{}'::jsonb) || '{"syllabus":true}'::jsonb
WHERE "features"->>'timetable' = 'true'
  AND "features"->>'staffDocuments' = 'true'
  AND "features"->>'advancedReports' = 'true'
  AND "features"->>'customBranding' = 'true'
  AND "features"->>'calendar' = 'true'
  AND "features"->>'feeConcession' = 'true'
  AND "features"->>'transferCertificate' = 'true'
  AND "features"->>'pettyCash' = 'true';
