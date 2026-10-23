-- A route's link to the bus company's own tracking page, shown to parents.
ALTER TABLE "transport_routes" ADD COLUMN "tracking_url" VARCHAR(500);
