-- Creates (or resets the password of) the platform super_admin account.
-- Safe to run on Supabase's SQL editor, or via `psql "$DATABASE_URL" -f this-file.sql`.
--
-- The super_admin is attached to a dedicated, inactive, non-school "platform"
-- tenant rather than a real school. This matters: a super_admin previously
-- lived under a demo school tenant in this project, and permanently deleting
-- that tenant cascaded and deleted the super_admin account along with it,
-- locking out platform access. This script avoids that failure mode.
--
-- EDIT the three variables below before running.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_email    text := 'superadmin@platform.local';   -- <-- change me
  v_password text := 'ChangeMe123!';                -- <-- change me (min 8 chars)
  v_name     text := 'Super Admin';                 -- <-- change me
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'platform';

  IF v_tenant_id IS NULL THEN
    INSERT INTO tenants (id, slug, name, is_active, updated_at)
    VALUES (
      gen_random_uuid(),
      'platform',
      'Platform (system account holder — not a real school)',
      false,
      now()
    )
    RETURNING id INTO v_tenant_id;
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE tenant_id = v_tenant_id AND email = v_email) THEN
    UPDATE users
    SET password_hash = crypt(v_password, gen_salt('bf', 12)),
        role = 'super_admin'::"Role",
        is_verified = true,
        updated_at = now()
    WHERE tenant_id = v_tenant_id AND email = v_email;

    RAISE NOTICE 'Updated existing super_admin: %', v_email;
  ELSE
    INSERT INTO users (id, tenant_id, email, name, role, password_hash, is_verified, updated_at)
    VALUES (
      gen_random_uuid(),
      v_tenant_id,
      v_email,
      v_name,
      'super_admin'::"Role",
      crypt(v_password, gen_salt('bf', 12)),
      true,
      now()
    );

    RAISE NOTICE 'Created super_admin: %', v_email;
  END IF;
END $$;
