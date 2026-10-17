-- Subscriptions (docs/SPEC-subscriptions.md): plan, period and renewal history.

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('basic', 'premium', 'premium_max');

-- AlterTable: added nullable, filled for existing schools, then required.
ALTER TABLE "tenants" ADD COLUMN "subscription_plan" "SubscriptionPlan" NOT NULL DEFAULT 'basic',
ADD COLUMN "subscription_starts_on" DATE,
ADD COLUMN "subscription_ends_on" DATE;

-- Existing schools: the plan their module flags already match (Premium Max =
-- every Premium module + HR + AI), started on their creation date, and one year
-- from today so nobody is switched off by surprise.
UPDATE "tenants"
SET "subscription_plan" = (CASE
      WHEN "features"->>'timetable' = 'true'
       AND "features"->>'staffDocuments' = 'true'
       AND "features"->>'advancedReports' = 'true'
       AND "features"->>'customBranding' = 'true'
       AND "features"->>'calendar' = 'true'
       AND "features"->>'feeConcession' = 'true'
       AND "features"->>'transferCertificate' = 'true'
       AND "features"->>'pettyCash' = 'true'
      THEN (CASE WHEN "features"->>'hrms' = 'true' AND "features"->>'aiInsights' = 'true'
                 THEN 'premium_max' ELSE 'premium' END)
      ELSE 'basic'
    END)::"SubscriptionPlan",
    "subscription_starts_on" = ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date,
    "subscription_ends_on" = ((now() AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 year' - INTERVAL '1 day')::date;

-- Defaults cover schools created outside the API (seeds); the API sets both.
ALTER TABLE "tenants" ALTER COLUMN "subscription_starts_on" SET NOT NULL,
ALTER COLUMN "subscription_starts_on" SET DEFAULT CURRENT_DATE,
ALTER COLUMN "subscription_ends_on" SET NOT NULL,
ALTER COLUMN "subscription_ends_on" SET DEFAULT ((CURRENT_DATE + '1 year'::interval) - '1 day'::interval);

-- CreateTable
CREATE TABLE "subscription_renewals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "previous_ends_on" DATE NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "amount" DECIMAL(12,2),
    "reference" TEXT,
    "note" TEXT,
    "renewed_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_renewals_tenant_id_created_at_idx" ON "subscription_renewals"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
