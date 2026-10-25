-- Email code at sign-in (MFA): platform logins always; schools on Premium Max (flag loginCodes) when the admin switches it on.
-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "login_codes" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "login_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sends" INTEGER NOT NULL DEFAULT 1,
    "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_challenges_user_id_idx" ON "login_challenges"("user_id");

-- AddForeignKey
ALTER TABLE "login_challenges" ADD CONSTRAINT "login_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Premium Max schools get the feature with their plan (the school switch itself starts off).
UPDATE "tenants"
SET "features" = COALESCE("features", '{}'::jsonb) || '{"loginCodes": true}'::jsonb
WHERE "subscription_plan" = 'premium_max';
