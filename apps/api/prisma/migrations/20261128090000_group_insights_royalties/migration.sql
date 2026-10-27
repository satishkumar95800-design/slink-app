-- CreateEnum
CREATE TYPE "RoyaltyMode" AS ENUM ('percent', 'fixed');

-- AlterTable
ALTER TABLE "ai_usage" ADD COLUMN     "group_id" UUID,
ALTER COLUMN "tenant_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "royalty_terms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mode" "RoyaltyMode" NOT NULL,
    "percent" DECIMAL(5,2),
    "fixed_amount" DECIMAL(12,2),
    "minimum_amount" DECIMAL(12,2),
    "effective_from" VARCHAR(7) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "royalty_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "royalty_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "received_on" DATE NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMP(3),
    "voided_by" UUID,
    "void_reason" TEXT,

    CONSTRAINT "royalty_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_ai_briefs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "language" VARCHAR(8) NOT NULL,
    "text" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailed_at" TIMESTAMP(3),

    CONSTRAINT "group_ai_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "royalty_terms_group_id_tenant_id_effective_from_idx" ON "royalty_terms"("group_id", "tenant_id", "effective_from");

-- CreateIndex
CREATE INDEX "royalty_payments_group_id_tenant_id_month_idx" ON "royalty_payments"("group_id", "tenant_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "group_ai_briefs_group_id_week_start_language_key" ON "group_ai_briefs"("group_id", "week_start", "language");

-- CreateIndex
CREATE INDEX "ai_usage_group_id_created_at_idx" ON "ai_usage"("group_id", "created_at");

-- AddForeignKey
ALTER TABLE "royalty_terms" ADD CONSTRAINT "royalty_terms_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "school_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "royalty_terms" ADD CONSTRAINT "royalty_terms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "royalty_payments" ADD CONSTRAINT "royalty_payments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "school_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "royalty_payments" ADD CONSTRAINT "royalty_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_ai_briefs" ADD CONSTRAINT "group_ai_briefs_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "school_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "school_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A usage row belongs to a school or to a group's head office.
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_owner_check" CHECK ("tenant_id" IS NOT NULL OR "group_id" IS NOT NULL);
