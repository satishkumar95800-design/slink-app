-- Plan flags (Basic / Premium / Gold). Timetable, shared staff documents,
-- the attendance and fee reports, and a school changing its own branding were
-- on for every school before plans existed, so existing schools keep them.
-- New schools start without them until the platform team picks a plan.
UPDATE "tenants"
SET "features" = COALESCE("features", '{}'::jsonb)
  || '{"timetable":true,"staffDocuments":true,"advancedReports":true,"customBranding":true}'::jsonb;
