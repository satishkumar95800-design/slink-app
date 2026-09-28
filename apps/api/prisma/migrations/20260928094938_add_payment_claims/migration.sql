-- CreateEnum
CREATE TYPE "ClaimPaymentMode" AS ENUM ('cash', 'cheque', 'bank_transfer', 'upi');

-- CreateEnum
CREATE TYPE "PaymentClaimStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "payment_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "student_fee_id" UUID NOT NULL,
    "submitted_by" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "claimed_amount" DECIMAL(12,2),
    "claimed_date" DATE,
    "claimed_mode" "ClaimPaymentMode",
    "note" TEXT,
    "status" "PaymentClaimStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_claims_tenant_id_idx" ON "payment_claims"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_claims_student_fee_id_idx" ON "payment_claims"("student_fee_id");

-- CreateIndex
CREATE INDEX "payment_claims_status_idx" ON "payment_claims"("status");

-- AddForeignKey
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_student_fee_id_fkey" FOREIGN KEY ("student_fee_id") REFERENCES "student_fees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
