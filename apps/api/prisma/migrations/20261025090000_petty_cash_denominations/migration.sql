-- AlterTable
ALTER TABLE "petty_cash_settings" ADD COLUMN     "track_denominations" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "petty_cash_entries" ADD COLUMN     "denominations" JSONB;

-- CreateTable
CREATE TABLE "petty_cash_counts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "counts" JSONB NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "ledger_balance" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "counted_by" UUID NOT NULL,
    "counted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petty_cash_counts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "petty_cash_counts_tenant_id_counted_at_idx" ON "petty_cash_counts"("tenant_id", "counted_at");

-- AddForeignKey
ALTER TABLE "petty_cash_counts" ADD CONSTRAINT "petty_cash_counts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

