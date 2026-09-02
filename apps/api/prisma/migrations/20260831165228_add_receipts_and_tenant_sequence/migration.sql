-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'cheque', 'bank_transfer', 'demand_draft', 'gateway');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "receipt_sequence" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "student_fee_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "paid_on" DATE NOT NULL,
    "notes" TEXT,
    "recorded_by" UUID,
    "payment_order_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipts_payment_order_id_key" ON "receipts"("payment_order_id");

-- CreateIndex
CREATE INDEX "receipts_tenant_id_paid_on_idx" ON "receipts"("tenant_id", "paid_on");

-- CreateIndex
CREATE INDEX "receipts_student_id_idx" ON "receipts"("student_id");

-- CreateIndex
CREATE INDEX "receipts_class_id_idx" ON "receipts"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_tenant_id_receipt_number_key" ON "receipts"("tenant_id", "receipt_number");

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_student_fee_id_fkey" FOREIGN KEY ("student_fee_id") REFERENCES "student_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
