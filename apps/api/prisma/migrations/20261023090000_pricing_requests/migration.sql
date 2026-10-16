-- Marketing site: plan interest on demo requests, and price-list downloads.
ALTER TABLE "contact_requests" ADD COLUMN "interested_plan" TEXT;

CREATE TABLE "pricing_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "emailed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pricing_requests_created_at_idx" ON "pricing_requests"("created_at");
