-- Per-school extras behind tenants.features flags: transfer certificates
-- (features.transferCertificate) and percentage fee concessions
-- (features.feeConcession). Additive only.

-- AlterTable
ALTER TABLE "students" ADD COLUMN "tc_file_key" TEXT,
ADD COLUMN "tc_uploaded_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "fee_concessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "fee_item_id" UUID,
    "percentage" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "given_on" DATE NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_concessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_concessions_tenant_id_given_on_idx" ON "fee_concessions"("tenant_id", "given_on");

-- CreateIndex
CREATE INDEX "fee_concessions_student_id_idx" ON "fee_concessions"("student_id");

-- AddForeignKey
ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_fee_item_id_fkey" FOREIGN KEY ("fee_item_id") REFERENCES "fee_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
