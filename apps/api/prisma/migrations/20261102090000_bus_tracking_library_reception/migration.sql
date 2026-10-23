-- CreateEnum
CREATE TYPE "BusTripDirection" AS ENUM ('pickup', 'drop');

-- CreateEnum
CREATE TYPE "LibraryCopyStatus" AS ENUM ('available', 'lost', 'damaged', 'withdrawn');

-- CreateEnum
CREATE TYPE "LibraryFineStatus" AS ENUM ('none', 'due', 'paid', 'waived');

-- CreateEnum
CREATE TYPE "FollowUpKind" AS ENUM ('call', 'visit', 'whatsapp', 'email', 'other');

-- CreateEnum
CREATE TYPE "DeskPaymentMode" AS ENUM ('cash', 'upi', 'card', 'cheque', 'bank_transfer');

-- CreateEnum
CREATE TYPE "VisitorPurpose" AS ENUM ('admission_enquiry', 'parent_meeting', 'interview', 'vendor', 'delivery', 'official', 'other');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('incoming', 'outgoing');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'driver';
ALTER TYPE "Role" ADD VALUE 'librarian';
ALTER TYPE "Role" ADD VALUE 'receptionist';

-- AlterTable
ALTER TABLE "petty_cash_payees" ADD COLUMN     "user_id" UUID;

-- CreateTable
CREATE TABLE "bus_trips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "driver_user_id" UUID NOT NULL,
    "direction" "BusTripDirection" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "position_at" TIMESTAMP(3),

    CONSTRAINT "bus_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_books" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "publisher" TEXT,
    "category" TEXT,
    "language" TEXT,
    "shelf" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_copies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "accession_no" TEXT NOT NULL,
    "status" "LibraryCopyStatus" NOT NULL DEFAULT 'available',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_copies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_loans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "copy_id" UUID NOT NULL,
    "student_id" UUID,
    "user_id" UUID,
    "issued_on" DATE NOT NULL,
    "due_on" DATE NOT NULL,
    "returned_on" DATE,
    "fine_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fine_status" "LibraryFineStatus" NOT NULL DEFAULT 'none',
    "issued_by" UUID NOT NULL,
    "returned_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_settings" (
    "tenant_id" UUID NOT NULL,
    "student_loan_days" INTEGER NOT NULL DEFAULT 14,
    "staff_loan_days" INTEGER NOT NULL DEFAULT 30,
    "max_student_books" INTEGER NOT NULL DEFAULT 2,
    "max_staff_books" INTEGER NOT NULL DEFAULT 5,
    "fine_per_day" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "admission_follow_ups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "due_on" DATE NOT NULL,
    "kind" "FollowUpKind" NOT NULL,
    "note" TEXT,
    "done_at" TIMESTAMP(3),
    "done_by" UUID,
    "outcome" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_documents" (
    "enquiry_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" UUID NOT NULL,
    "note" TEXT,

    CONSTRAINT "admission_documents_pkey" PRIMARY KEY ("enquiry_id","kind")
);

-- CreateTable
CREATE TABLE "admission_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "receipt_no" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "mode" "DeskPaymentMode" NOT NULL,
    "reference" TEXT,
    "received_on" DATE NOT NULL,
    "received_by" UUID NOT NULL,
    "voided_at" TIMESTAMP(3),
    "voided_by" UUID,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "purpose" "VisitorPurpose" NOT NULL,
    "whom_to_meet" TEXT,
    "people" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "out_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "enquiry_id" UUID,
    "purpose" TEXT,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bus_trips_tenant_id_route_id_started_at_idx" ON "bus_trips"("tenant_id", "route_id", "started_at");

-- CreateIndex
CREATE INDEX "bus_trips_driver_user_id_ended_at_idx" ON "bus_trips"("driver_user_id", "ended_at");

-- CreateIndex
CREATE INDEX "library_books_tenant_id_title_idx" ON "library_books"("tenant_id", "title");

-- CreateIndex
CREATE INDEX "library_copies_book_id_idx" ON "library_copies"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "library_copies_tenant_id_accession_no_key" ON "library_copies"("tenant_id", "accession_no");

-- CreateIndex
CREATE INDEX "library_loans_tenant_id_returned_on_due_on_idx" ON "library_loans"("tenant_id", "returned_on", "due_on");

-- CreateIndex
CREATE INDEX "library_loans_student_id_idx" ON "library_loans"("student_id");

-- CreateIndex
CREATE INDEX "library_loans_user_id_idx" ON "library_loans"("user_id");

-- CreateIndex
CREATE INDEX "admission_follow_ups_tenant_id_done_at_due_on_idx" ON "admission_follow_ups"("tenant_id", "done_at", "due_on");

-- CreateIndex
CREATE INDEX "admission_follow_ups_enquiry_id_idx" ON "admission_follow_ups"("enquiry_id");

-- CreateIndex
CREATE INDEX "admission_payments_enquiry_id_idx" ON "admission_payments"("enquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "admission_payments_tenant_id_receipt_no_key" ON "admission_payments"("tenant_id", "receipt_no");

-- CreateIndex
CREATE INDEX "visitors_tenant_id_in_at_idx" ON "visitors"("tenant_id", "in_at");

-- CreateIndex
CREATE INDEX "call_logs_tenant_id_at_idx" ON "call_logs"("tenant_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "petty_cash_payees_user_id_key" ON "petty_cash_payees"("user_id");

-- AddForeignKey
ALTER TABLE "bus_trips" ADD CONSTRAINT "bus_trips_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_trips" ADD CONSTRAINT "bus_trips_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_trips" ADD CONSTRAINT "bus_trips_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "library_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_copy_id_fkey" FOREIGN KEY ("copy_id") REFERENCES "library_copies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_settings" ADD CONSTRAINT "library_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_follow_ups" ADD CONSTRAINT "admission_follow_ups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_follow_ups" ADD CONSTRAINT "admission_follow_ups_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "admission_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "admission_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_payments" ADD CONSTRAINT "admission_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_payments" ADD CONSTRAINT "admission_payments_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "admission_enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "admission_enquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_payees" ADD CONSTRAINT "petty_cash_payees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One open trip per bus route, one open loan per library copy.
CREATE UNIQUE INDEX "bus_trips_one_open_per_route" ON "bus_trips"("route_id") WHERE "ended_at" IS NULL;
CREATE UNIQUE INDEX "library_loans_one_open_per_copy" ON "library_loans"("copy_id") WHERE "returned_on" IS NULL;

-- A loan is to a student or to a staff member, never both or neither.
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_one_borrower"
  CHECK (("student_id" IS NULL) <> ("user_id" IS NULL));

-- Live bus tracking and the library are part of Premium Max.
UPDATE "tenants"
SET "features" = COALESCE("features", '{}'::jsonb) || '{"busTracking":true,"library":true}'::jsonb
WHERE "subscription_plan" = 'premium_max';
