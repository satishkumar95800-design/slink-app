-- Staff folder for photo albums: never shown to parents.
ALTER TABLE "photo_albums" ADD COLUMN "for_staff" BOOLEAN NOT NULL DEFAULT false;

-- Front desk appointments (interviews, parent meetings...).
CREATE TYPE "AppointmentKind" AS ENUM ('interview', 'parent_meeting', 'admission_visit', 'vendor', 'other');
CREATE TYPE "AppointmentStatus" AS ENUM ('scheduled', 'arrived', 'cancelled', 'no_show');

CREATE TABLE "appointments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "kind" "AppointmentKind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20),
    "with_whom" VARCHAR(120),
    "date" DATE NOT NULL,
    "time" VARCHAR(5) NOT NULL,
    "note" VARCHAR(300),
    "status" "AppointmentStatus" NOT NULL DEFAULT 'scheduled',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appointments_tenant_id_date_time_idx" ON "appointments"("tenant_id", "date", "time");

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
