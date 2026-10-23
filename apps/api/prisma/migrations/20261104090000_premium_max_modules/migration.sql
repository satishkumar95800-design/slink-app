-- Admissions (with the front desk), syllabus progress and petty cash move from
-- Premium to Premium Max. Switch them off for schools on Premium; their data
-- stays and comes back if the school moves to Premium Max (or the platform
-- team switches a module on as an extra).
UPDATE "tenants"
SET "features" = COALESCE("features", '{}'::jsonb)
  || '{"admissions":false,"syllabus":false,"pettyCash":false}'::jsonb
WHERE "subscription_plan" = 'premium';
