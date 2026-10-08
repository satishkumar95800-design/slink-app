-- Additive: link an approved payment claim to the receipt it produced, so the
-- admin dashboard can label that payment "Claim". Existing rows stay NULL.
ALTER TABLE "payment_claims" ADD COLUMN "receipt_id" UUID;

CREATE UNIQUE INDEX "payment_claims_receipt_id_key" ON "payment_claims"("receipt_id");

ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
