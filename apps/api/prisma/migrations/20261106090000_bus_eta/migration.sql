-- Stop locations for the parents' arrival time, and per-trip progress so the
-- "bus arriving in 5 minutes" push goes once per stop.
ALTER TABLE "transport_stops" ADD COLUMN "lat" DOUBLE PRECISION,
ADD COLUMN "lng" DOUBLE PRECISION;

ALTER TABLE "bus_trips" ADD COLUMN "passed_stop_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "alerted_stop_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
