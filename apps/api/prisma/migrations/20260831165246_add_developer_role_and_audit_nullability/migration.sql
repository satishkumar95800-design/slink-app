-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'developer';

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "tenant_id" DROP NOT NULL,
ALTER COLUMN "entity_id" DROP NOT NULL;
