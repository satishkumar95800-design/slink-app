-- Additive only: HR & payroll (employees, staff attendance, leave, salary structures, pay runs).
-- Generated with `prisma migrate diff` (no database was reachable/used); CHECK constraints and the
-- partial unique index were added by hand. Not applied by the author.

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'CONTRACT', 'PART_TIME', 'DAILY_WAGE');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'EXITED');

-- CreateEnum
CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkingDaysRule" AS ENUM ('CALENDAR', 'FIXED_30', 'WORKING_DAYS');

-- CreateEnum
CREATE TYPE "PayRunStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'LOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayItemKind" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayItemSource" AS ENUM ('STRUCTURE', 'STATUTORY', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "hr_settings" (
    "tenant_id" UUID NOT NULL,
    "weekly_off_days" INTEGER[] DEFAULT ARRAY[0]::INTEGER[],
    "working_days_rule" "WorkingDaysRule" NOT NULL DEFAULT 'CALENDAR',
    "treat_unmarked_as_absent" BOOLEAN NOT NULL DEFAULT false,
    "leave_year_start_month" INTEGER NOT NULL DEFAULT 4,
    "pf_enabled" BOOLEAN NOT NULL DEFAULT true,
    "pf_employee_rate" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "pf_employer_rate" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "pf_wage_ceiling" DECIMAL(12,2) NOT NULL DEFAULT 15000,
    "esi_enabled" BOOLEAN NOT NULL DEFAULT true,
    "esi_employee_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.75,
    "esi_employer_rate" DECIMAL(5,2) NOT NULL DEFAULT 3.25,
    "esi_wage_ceiling" DECIMAL(12,2) NOT NULL DEFAULT 21000,
    "pt_enabled" BOOLEAN NOT NULL DEFAULT true,
    "pt_slabs" JSONB NOT NULL DEFAULT '[]',
    "slabs_seeded" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "employee_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "designation" TEXT NOT NULL,
    "department" TEXT,
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
    "join_date" DATE NOT NULL,
    "exit_date" DATE,
    "exit_reason" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "pan_enc" TEXT,
    "aadhaar_enc" TEXT,
    "uan_enc" TEXT,
    "esi_number_enc" TEXT,
    "bank_account_enc" TEXT,
    "bank_ifsc_enc" TEXT,
    "bank_holder_enc" TEXT,
    "sensitive_hints" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "StaffAttendanceStatus" NOT NULL,
    "note" TEXT,
    "leave_request_id" UUID,
    "marked_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "yearly_allowance" DECIMAL(5,1) NOT NULL,
    "carry_forward_cap" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "half_day" BOOLEAN NOT NULL DEFAULT false,
    "days" DECIMAL(5,1) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" UUID NOT NULL,
    "decided_by" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "basic" DECIMAL(12,2) NOT NULL,
    "components" JSONB NOT NULL DEFAULT '[]',
    "pf_applicable" BOOLEAN NOT NULL DEFAULT false,
    "esi_applicable" BOOLEAN NOT NULL DEFAULT false,
    "pt_applicable" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "status" "PayRunStatus" NOT NULL DEFAULT 'DRAFT',
    "settings_snapshot" JSONB NOT NULL,
    "prepared_by" UUID NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "self_approved" BOOLEAN NOT NULL DEFAULT false,
    "locked_by" UUID,
    "locked_at" TIMESTAMP(3),
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "paid_by" UUID,
    "payment_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_run_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "pay_run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "employee_code" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "department" TEXT,
    "structure_id" UUID,
    "period_days" INTEGER NOT NULL,
    "lop_days" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "paid_days" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "unmarked_days" INTEGER NOT NULL DEFAULT 0,
    "gross_earnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_pay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "employer_pf" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "employer_esi" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bank_account_enc" TEXT,
    "bank_ifsc_enc" TEXT,
    "bank_holder_enc" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pay_run_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_run_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "kind" "PayItemKind" NOT NULL,
    "source" "PayItemSource" NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pay_run_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_tenant_id_status_idx" ON "employees"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employees_tenant_id_employee_code_key" ON "employees"("tenant_id", "employee_code");

-- CreateIndex
CREATE INDEX "employee_documents_tenant_id_employee_id_idx" ON "employee_documents"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "staff_attendance_tenant_id_date_idx" ON "staff_attendance"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "staff_attendance_employee_id_date_key" ON "staff_attendance"("employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_tenant_id_name_key" ON "leave_types"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "leave_requests_tenant_id_status_idx" ON "leave_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_from_date_idx" ON "leave_requests"("employee_id", "from_date");

-- CreateIndex
CREATE INDEX "salary_structures_tenant_id_employee_id_idx" ON "salary_structures"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_employee_id_effective_from_key" ON "salary_structures"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "pay_runs_tenant_id_month_idx" ON "pay_runs"("tenant_id", "month");

-- CreateIndex
CREATE INDEX "pay_run_lines_tenant_id_employee_id_idx" ON "pay_run_lines"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_run_lines_pay_run_id_employee_id_key" ON "pay_run_lines"("pay_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "pay_run_line_items_line_id_idx" ON "pay_run_line_items"("line_id");

-- AddForeignKey
ALTER TABLE "hr_settings" ADD CONSTRAINT "hr_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_run_lines" ADD CONSTRAINT "pay_run_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_run_lines" ADD CONSTRAINT "pay_run_lines_pay_run_id_fkey" FOREIGN KEY ("pay_run_id") REFERENCES "pay_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_run_lines" ADD CONSTRAINT "pay_run_lines_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_run_line_items" ADD CONSTRAINT "pay_run_line_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_run_line_items" ADD CONSTRAINT "pay_run_line_items_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "pay_run_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written: one non-cancelled pay run per school per month.
CREATE UNIQUE INDEX "pay_runs_tenant_id_month_active_key" ON "pay_runs"("tenant_id", "month") WHERE "status" <> 'CANCELLED';

-- Hand-written: money is never negative and values stay in sane ranges.
ALTER TABLE "hr_settings" ADD CONSTRAINT "hr_settings_rates_check" CHECK (
  "pf_employee_rate" >= 0 AND "pf_employee_rate" <= 100 AND "pf_employer_rate" >= 0 AND "pf_employer_rate" <= 100
  AND "esi_employee_rate" >= 0 AND "esi_employee_rate" <= 100 AND "esi_employer_rate" >= 0 AND "esi_employer_rate" <= 100
  AND "pf_wage_ceiling" >= 0 AND "esi_wage_ceiling" >= 0
  AND "leave_year_start_month" BETWEEN 1 AND 12
);
ALTER TABLE "employees" ADD CONSTRAINT "employees_exit_after_join_check" CHECK ("exit_date" IS NULL OR "exit_date" >= "join_date");
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_days_check" CHECK ("yearly_allowance" >= 0 AND "carry_forward_cap" >= 0);
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_dates_check" CHECK ("to_date" >= "from_date" AND "days" >= 0);
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_basic_check" CHECK ("basic" >= 0);
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_month_check" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "pay_run_lines" ADD CONSTRAINT "pay_run_lines_amounts_check" CHECK (
  "gross_earnings" >= 0 AND "total_deductions" >= 0 AND "net_pay" >= 0 AND "employer_pf" >= 0 AND "employer_esi" >= 0
  AND "lop_days" >= 0 AND "paid_days" >= 0 AND "period_days" > 0
);
ALTER TABLE "pay_run_line_items" ADD CONSTRAINT "pay_run_line_items_amount_check" CHECK ("amount" >= 0);
