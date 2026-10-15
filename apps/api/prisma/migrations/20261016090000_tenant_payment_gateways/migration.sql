-- Additive only: per-school Razorpay keys (secrets encrypted by the API).

-- CreateTable
CREATE TABLE "tenant_payment_gateways" (
    "tenant_id" UUID NOT NULL,
    "key_id" TEXT NOT NULL,
    "key_secret_enc" TEXT NOT NULL,
    "webhook_secret_enc" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_payment_gateways_pkey" PRIMARY KEY ("tenant_id")
);

-- AddForeignKey
ALTER TABLE "tenant_payment_gateways" ADD CONSTRAINT "tenant_payment_gateways_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

