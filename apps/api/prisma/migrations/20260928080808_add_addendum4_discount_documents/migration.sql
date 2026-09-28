-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "discount_amount" DECIMAL(12,2),
ADD COLUMN     "discount_note" TEXT,
ADD COLUMN     "discount_type_id" UUID,
ADD COLUMN     "pdf_generated_at" TIMESTAMP(3),
ADD COLUMN     "pdf_key" TEXT,
ADD COLUMN     "receipt_delivered_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "document_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountant_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "note" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accountant_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_categories_tenant_id_idx" ON "document_categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_categories_tenant_id_name_key" ON "document_categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "accountant_documents_tenant_id_idx" ON "accountant_documents"("tenant_id");

-- CreateIndex
CREATE INDEX "accountant_documents_category_id_idx" ON "accountant_documents"("category_id");

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_discount_type_id_fkey" FOREIGN KEY ("discount_type_id") REFERENCES "discount_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_documents" ADD CONSTRAINT "accountant_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_documents" ADD CONSTRAINT "accountant_documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
