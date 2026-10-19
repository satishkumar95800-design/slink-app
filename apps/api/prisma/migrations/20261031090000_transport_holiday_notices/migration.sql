-- CreateTable
CREATE TABLE "transport_routes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "vehicle_number" TEXT,
    "driver_id" UUID,
    "attendant_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_stops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "pickup_time" VARCHAR(5),
    "drop_time" VARCHAR(5),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_transport" (
    "student_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "stop_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_transport_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "holiday_notices" (
    "tenant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_notices_pkey" PRIMARY KEY ("tenant_id","date")
);

-- CreateIndex
CREATE INDEX "transport_routes_tenant_id_idx" ON "transport_routes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "transport_routes_tenant_id_name_key" ON "transport_routes"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "transport_stops_route_id_sort_order_idx" ON "transport_stops"("route_id", "sort_order");

-- CreateIndex
CREATE INDEX "student_transport_tenant_id_route_id_idx" ON "student_transport"("tenant_id", "route_id");

-- AddForeignKey
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "petty_cash_payees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_attendant_id_fkey" FOREIGN KEY ("attendant_id") REFERENCES "petty_cash_payees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_stops" ADD CONSTRAINT "transport_stops_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_stops" ADD CONSTRAINT "transport_stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transport" ADD CONSTRAINT "student_transport_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transport" ADD CONSTRAINT "student_transport_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transport" ADD CONSTRAINT "student_transport_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transport" ADD CONSTRAINT "student_transport_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "transport_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_notices" ADD CONSTRAINT "holiday_notices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- School bus routes are part of Premium and Premium Max.
UPDATE "tenants"
SET "features" = COALESCE("features", '{}'::jsonb) || '{"transport":true}'::jsonb
WHERE "subscription_plan" IN ('premium', 'premium_max');
