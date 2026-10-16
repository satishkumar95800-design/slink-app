-- Additive only: shared staff documents (folders + files every teacher/admin/accounts user of the school can see).
-- Generated with `prisma migrate diff` against the previous schema.

-- CreateTable
CREATE TABLE "staff_folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_folders_tenant_id_idx" ON "staff_folders"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_folders_tenant_id_name_key" ON "staff_folders"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "staff_files_tenant_id_folder_id_idx" ON "staff_files"("tenant_id", "folder_id");

-- AddForeignKey
ALTER TABLE "staff_folders" ADD CONSTRAINT "staff_folders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_files" ADD CONSTRAINT "staff_files_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_files" ADD CONSTRAINT "staff_files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "staff_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

