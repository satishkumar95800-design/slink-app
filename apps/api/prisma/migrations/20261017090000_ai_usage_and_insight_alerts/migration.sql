-- Additive only: AI usage log, pattern-warning alerts and payment-proof checks (docs/SPEC-ai.md).

-- CreateTable
CREATE TABLE "payment_claim_checks" (
    "claim_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "paid_on" DATE,
    "reference" TEXT,
    "payee" TEXT,
    "flags" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_claim_checks_pkey" PRIMARY KEY ("claim_id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insight_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID,
    "subject_name" TEXT,
    "reasons" JSONB NOT NULL,
    "audience" TEXT NOT NULL,
    "teacher_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dedupe_key" TEXT NOT NULL,
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insight_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_claim_checks_tenant_id_reference_idx" ON "payment_claim_checks"("tenant_id", "reference");

-- CreateIndex
CREATE INDEX "ai_usage_tenant_id_created_at_idx" ON "ai_usage"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "insight_alerts_tenant_id_status_audience_idx" ON "insight_alerts"("tenant_id", "status", "audience");

-- CreateIndex
CREATE UNIQUE INDEX "insight_alerts_tenant_id_dedupe_key_key" ON "insight_alerts"("tenant_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "payment_claim_checks" ADD CONSTRAINT "payment_claim_checks_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "payment_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight_alerts" ADD CONSTRAINT "insight_alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

