-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'head_office';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "group_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "group_id" UUID;

-- CreateTable
CREATE TABLE "school_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_groups_name_key" ON "school_groups"("name");

-- CreateIndex
CREATE INDEX "tenants_group_id_idx" ON "tenants"("group_id");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "school_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "school_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

