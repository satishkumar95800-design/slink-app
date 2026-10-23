-- Photo albums for parents (Premium Max, flag photoAlbums).
CREATE TABLE "photo_albums" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "event_date" DATE,
    "class_ids" UUID[],
    "student_ids" UUID[],
    "created_by" UUID NOT NULL,
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "extended" BOOLEAN NOT NULL DEFAULT false,
    "reminder_sent_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_albums_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "album_photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "album_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "thumb_key" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "album_photos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "album_downloads" (
    "album_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "album_downloads_pkey" PRIMARY KEY ("album_id","user_id")
);

CREATE INDEX "photo_albums_tenant_id_created_at_idx" ON "photo_albums"("tenant_id", "created_at");
CREATE INDEX "photo_albums_expires_at_idx" ON "photo_albums"("expires_at");
CREATE INDEX "album_photos_album_id_created_at_idx" ON "album_photos"("album_id", "created_at");
CREATE INDEX "album_photos_tenant_id_idx" ON "album_photos"("tenant_id");

ALTER TABLE "photo_albums" ADD CONSTRAINT "photo_albums_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "album_photos" ADD CONSTRAINT "album_photos_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "photo_albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "album_downloads" ADD CONSTRAINT "album_downloads_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "photo_albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Premium Max schools get it with their plan.
UPDATE "tenants"
SET "features" = COALESCE("features", '{}'::jsonb) || '{"photoAlbums": true}'::jsonb
WHERE "subscription_plan" = 'premium_max';
