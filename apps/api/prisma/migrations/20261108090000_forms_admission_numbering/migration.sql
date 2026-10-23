-- How a school's new admission numbers are made (null: typed by hand).
ALTER TABLE "tenants" ADD COLUMN "admission_numbering" JSONB;

-- Blank forms the front desk prints for visitors and parents to sign.
CREATE TABLE "reception_forms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "note" VARCHAR(300),
    "file_key" TEXT NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reception_forms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reception_forms_tenant_id_title_idx" ON "reception_forms"("tenant_id", "title");

ALTER TABLE "reception_forms" ADD CONSTRAINT "reception_forms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
