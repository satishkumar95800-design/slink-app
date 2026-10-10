-- Languages Stage 1 (docs/SPEC-languages.md): additive only.
-- users.preferred_language: null = follow the school's default.
-- tenants.default_language: the spec's "schools.default_language" (schools live in tenants).
-- Plain VARCHAR rather than an enum so adding a language never needs a migration;
-- allowed values are enforced in code (src/common/i18n/languages.ts).

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "default_language" VARCHAR(8) NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "preferred_language" VARCHAR(8);
