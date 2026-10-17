-- Parent consent forms for events (e.g. school trips): the classes each form goes to
-- and one signed answer per student.
-- CreateEnum
CREATE TYPE "ConsentDecision" AS ENUM ('APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "consent_forms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "deadline" DATE NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_form_classes" (
    "form_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,

    CONSTRAINT "consent_form_classes_pkey" PRIMARY KEY ("form_id","class_id")
);

-- CreateTable
CREATE TABLE "consent_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "form_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "parent_id" UUID,
    "decision" "ConsentDecision" NOT NULL,
    "signed_name" TEXT NOT NULL,
    "note" TEXT,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consent_forms_event_id_key" ON "consent_forms"("event_id");

-- CreateIndex
CREATE INDEX "consent_forms_tenant_id_idx" ON "consent_forms"("tenant_id");

-- CreateIndex
CREATE INDEX "consent_form_classes_class_id_idx" ON "consent_form_classes"("class_id");

-- CreateIndex
CREATE INDEX "consent_responses_parent_id_idx" ON "consent_responses"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "consent_responses_form_id_student_id_key" ON "consent_responses"("form_id", "student_id");

-- AddForeignKey
ALTER TABLE "consent_forms" ADD CONSTRAINT "consent_forms_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "school_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_form_classes" ADD CONSTRAINT "consent_form_classes_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "consent_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_form_classes" ADD CONSTRAINT "consent_form_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_responses" ADD CONSTRAINT "consent_responses_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "consent_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_responses" ADD CONSTRAINT "consent_responses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_responses" ADD CONSTRAINT "consent_responses_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

