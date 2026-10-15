-- Additive only: petty cash ledger, categories, payees and per-school settings.
-- Generated with `prisma migrate diff` (no database was reachable/used); CHECK constraints added by hand.
-- FKs use NO ACTION (checked at end of statement) so deleting a tenant still cascades cleanly.

-- CreateEnum
CREATE TYPE "PettyCashPayeeType" AS ENUM ('VENDOR', 'GROUND_STAFF');

-- CreateEnum
CREATE TYPE "PettyCashEntryType" AS ENUM ('TOP_UP', 'DISBURSEMENT', 'EXPENSE', 'RETURN');

-- CreateEnum
CREATE TYPE "PettyCashStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'VOIDED');

-- CreateTable
CREATE TABLE "petty_cash_settings" (
    "tenant_id" UUID NOT NULL,
    "approval_threshold" DECIMAL(12,2) NOT NULL DEFAULT 2000,
    "monthly_budget" DECIMAL(12,2),
    "receipt_required_above" DECIMAL(12,2) NOT NULL DEFAULT 500,
    "overdue_days" INTEGER NOT NULL DEFAULT 7,
    "categories_seeded" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "petty_cash_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "petty_cash_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_budget" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "petty_cash_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petty_cash_payees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "type" "PettyCashPayeeType" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "petty_cash_payees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petty_cash_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "type" "PettyCashEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "category_id" UUID,
    "description" TEXT NOT NULL,
    "receipt_key" TEXT,
    "recipient_user_id" UUID,
    "payee_id" UUID,
    "settles_entry_id" UUID,
    "status" "PettyCashStatus" NOT NULL,
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "void_reason" TEXT,
    "voided_by" UUID,
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petty_cash_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "petty_cash_categories_tenant_id_name_key" ON "petty_cash_categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "petty_cash_payees_tenant_id_is_active_idx" ON "petty_cash_payees"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "petty_cash_entries_tenant_id_date_idx" ON "petty_cash_entries"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "petty_cash_entries_tenant_id_status_idx" ON "petty_cash_entries"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "petty_cash_entries_tenant_id_type_status_idx" ON "petty_cash_entries"("tenant_id", "type", "status");

-- CreateIndex
CREATE INDEX "petty_cash_entries_settles_entry_id_idx" ON "petty_cash_entries"("settles_entry_id");

-- AddForeignKey
ALTER TABLE "petty_cash_settings" ADD CONSTRAINT "petty_cash_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_categories" ADD CONSTRAINT "petty_cash_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_payees" ADD CONSTRAINT "petty_cash_payees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_entries" ADD CONSTRAINT "petty_cash_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_entries" ADD CONSTRAINT "petty_cash_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "petty_cash_categories"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_entries" ADD CONSTRAINT "petty_cash_entries_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "petty_cash_payees"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_entries" ADD CONSTRAINT "petty_cash_entries_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_entries" ADD CONSTRAINT "petty_cash_entries_settles_entry_id_fkey" FOREIGN KEY ("settles_entry_id") REFERENCES "petty_cash_entries"("id") ON DELETE NO ACTION ON UPDATE CASCADE;


-- Defence in depth for rules the service also enforces.
ALTER TABLE "petty_cash_entries" ADD CONSTRAINT "petty_cash_entries_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "petty_cash_entries" ADD CONSTRAINT "petty_cash_entries_one_recipient" CHECK ("recipient_user_id" IS NULL OR "payee_id" IS NULL);
