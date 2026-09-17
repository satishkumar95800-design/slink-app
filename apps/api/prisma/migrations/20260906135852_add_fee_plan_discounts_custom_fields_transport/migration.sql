-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('one_time', 'monthly', 'quarterly');

-- CreateEnum
CREATE TYPE "DiscountKind" AS ENUM ('percentage', 'fixed_amount', 'full_waiver');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('text', 'number', 'dropdown');

-- AlterTable
ALTER TABLE "fee_items" ADD COLUMN     "billing_frequency" "BillingFrequency" NOT NULL DEFAULT 'one_time',
ADD COLUMN     "quarter_month_counts" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "fee_structures" ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "transport_slab_id" UUID;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "class_label" TEXT NOT NULL DEFAULT 'Class';

-- CreateTable
CREATE TABLE "class_teachers" (
    "class_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,

    CONSTRAINT "class_teachers_pkey" PRIMARY KEY ("class_id","teacher_id")
);

-- CreateTable
CREATE TABLE "fee_structure_classes" (
    "fee_structure_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,

    CONSTRAINT "fee_structure_classes_pkey" PRIMARY KEY ("fee_structure_id","class_id")
);

-- CreateTable
CREATE TABLE "student_fee_components" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_fee_id" UUID NOT NULL,
    "fee_item_id" UUID NOT NULL,
    "period_label" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "amount_due" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "FeeStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_fee_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receipt_id" UUID NOT NULL,
    "student_fee_component_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "receipt_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DiscountKind" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_discounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "discount_type_id" UUID NOT NULL,
    "fee_item_id" UUID,
    "percentage" DECIMAL(5,2),
    "fixed_amount" DECIMAL(12,2),
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" "CustomFieldType" NOT NULL,
    "options" JSONB,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_custom_field_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "field_definition_id" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_slabs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "min_distance_km" DECIMAL(6,2) NOT NULL,
    "max_distance_km" DECIMAL(6,2) NOT NULL,
    "monthly_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_slabs_pkey" PRIMARY KEY ("id")
);

-- DataMigration: preserve the existing single teacher-per-class assignment as a
-- ClassTeacher row before the classes.teacher_id column is dropped.
INSERT INTO "class_teachers" ("class_id", "teacher_id")
SELECT "id", "teacher_id" FROM "classes" WHERE "teacher_id" IS NOT NULL;

-- DataMigration: preserve the existing fee_structure -> class link as a
-- FeeStructureClass row before the fee_structures.class_id column is dropped.
INSERT INTO "fee_structure_classes" ("fee_structure_id", "class_id")
SELECT "id", "class_id" FROM "fee_structures" WHERE "class_id" IS NOT NULL;

-- DataMigration: disambiguate fee_structure names before the unique constraint
-- moves from (tenant_id, class_id, name, academic_year) to (tenant_id, name,
-- academic_year) — existing seed data has one same-named structure ("Term 1",
-- "Term 2") per class, reflecting the old one-plan-per-class model. Suffix each
-- with its linked class's name/section, which was itself unique per class per
-- academic year, so the result is guaranteed unique.
UPDATE "fee_structures" fs
SET "name" = fs."name" || ' — ' || c."name" || COALESCE(' ' || c."section", '')
FROM "classes" c
WHERE fs."class_id" = c."id";

-- DropForeignKey
ALTER TABLE "fee_structures" DROP CONSTRAINT "fee_structures_class_id_fkey";

-- DropIndex
DROP INDEX "fee_structures_tenant_id_class_id_name_academic_year_key";

-- AlterTable
ALTER TABLE "classes" DROP COLUMN "teacher_id";

-- AlterTable
ALTER TABLE "fee_structures" DROP COLUMN "class_id";

-- CreateIndex
CREATE INDEX "class_teachers_teacher_id_idx" ON "class_teachers"("teacher_id");

-- CreateIndex
CREATE INDEX "fee_structure_classes_class_id_idx" ON "fee_structure_classes"("class_id");

-- CreateIndex
CREATE INDEX "student_fee_components_student_fee_id_idx" ON "student_fee_components"("student_fee_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_fee_components_student_fee_id_fee_item_id_period_la_key" ON "student_fee_components"("student_fee_id", "fee_item_id", "period_label");

-- CreateIndex
CREATE INDEX "receipt_allocations_receipt_id_idx" ON "receipt_allocations"("receipt_id");

-- CreateIndex
CREATE INDEX "receipt_allocations_student_fee_component_id_idx" ON "receipt_allocations"("student_fee_component_id");

-- CreateIndex
CREATE INDEX "discount_types_tenant_id_idx" ON "discount_types"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_types_tenant_id_name_key" ON "discount_types"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "student_discounts_tenant_id_idx" ON "student_discounts"("tenant_id");

-- CreateIndex
CREATE INDEX "student_discounts_student_id_idx" ON "student_discounts"("student_id");

-- CreateIndex
CREATE INDEX "custom_field_definitions_tenant_id_idx" ON "custom_field_definitions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_tenant_id_label_key" ON "custom_field_definitions"("tenant_id", "label");

-- CreateIndex
CREATE INDEX "student_custom_field_values_tenant_id_idx" ON "student_custom_field_values"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_custom_field_values_student_id_field_definition_id_key" ON "student_custom_field_values"("student_id", "field_definition_id");

-- CreateIndex
CREATE INDEX "transport_slabs_tenant_id_idx" ON "transport_slabs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_structures_tenant_id_name_academic_year_key" ON "fee_structures"("tenant_id", "name", "academic_year");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_transport_slab_id_fkey" FOREIGN KEY ("transport_slab_id") REFERENCES "transport_slabs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structure_classes" ADD CONSTRAINT "fee_structure_classes_fee_structure_id_fkey" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structure_classes" ADD CONSTRAINT "fee_structure_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_components" ADD CONSTRAINT "student_fee_components_student_fee_id_fkey" FOREIGN KEY ("student_fee_id") REFERENCES "student_fees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_components" ADD CONSTRAINT "student_fee_components_fee_item_id_fkey" FOREIGN KEY ("fee_item_id") REFERENCES "fee_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_student_fee_component_id_fkey" FOREIGN KEY ("student_fee_component_id") REFERENCES "student_fee_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_types" ADD CONSTRAINT "discount_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_discount_type_id_fkey" FOREIGN KEY ("discount_type_id") REFERENCES "discount_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_fee_item_id_fkey" FOREIGN KEY ("fee_item_id") REFERENCES "fee_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_custom_field_values" ADD CONSTRAINT "student_custom_field_values_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_custom_field_values" ADD CONSTRAINT "student_custom_field_values_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_custom_field_values" ADD CONSTRAINT "student_custom_field_values_field_definition_id_fkey" FOREIGN KEY ("field_definition_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_slabs" ADD CONSTRAINT "transport_slabs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
