-- PROPOSED MIGRATION — NOT APPLIED. Apply only after explicit owner approval,
-- through the database migration tool (byte-for-byte this content).
-- Least-privilege access to public.platform_settings.
--
-- State verified in the database on 2026-11-09 (pg_class.relacl / pg_attribute.attacl):
--   anon, authenticated: every table privilege (arwdDxtm). Only SELECT appears in the repo
--     (0024); the rest comes from the schema's default privileges for role postgres.
--     Plus column SELECT on module_visibility, brand_settings, visual_effects (0053/0054/0056).
--     RLS has only a SELECT policy USING (true), so the public could read billing_*,
--     updated_by and updated_at.
--   PUBLIC: no table or column privileges.
--   service_role: every table privilege (arwdDxtm) — kept.
-- After: anon/authenticated may only SELECT the public columns below; writes stay
-- server-only (service_role after server-side admin/superadmin checks).

-- 1. Remove table-level privileges (SELECT and write privileges) from client roles and PUBLIC.
REVOKE ALL PRIVILEGES ON TABLE public.platform_settings FROM anon, authenticated, PUBLIC;

-- 2. Remove every column-level privilege for those roles; a table REVOKE does not clear column grants.
DO $$
DECLARE col text;
BEGIN
  FOR col IN
    SELECT a.attname FROM pg_attribute a
    WHERE a.attrelid = 'public.platform_settings'::regclass AND a.attnum > 0 AND NOT a.attisdropped
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES (%I) ON TABLE public.platform_settings FROM anon, authenticated, PUBLIC', col);
  END LOOP;
END $$;

-- 3. Grant SELECT only on columns the public site renders (id is needed for the id = 1 filter).
GRANT SELECT (
  id,
  platform_name, contact_email, support_email,
  notice_enabled, maintenance_enabled, maintenance_message,
  social_youtube, social_spotify, social_tiktok, social_instagram,
  podcast_layout, module_visibility, brand_settings, visual_effects,
  company_legal_name, company_legal_form, company_nip, company_regon, company_krs,
  company_address_street, company_address_postal, company_address_city, company_address_country,
  contact_phone, contact_hours,
  footer_description, footer_copyright, footer_show_contact
) ON public.platform_settings TO anon, authenticated;

-- 4. Server-side operations keep full access.
GRANT ALL ON TABLE public.platform_settings TO service_role;

COMMENT ON TABLE public.platform_settings IS
  'Singleton platform configuration. anon/authenticated: SELECT on listed public columns only. billing_*, updated_at, updated_by are admin-only and read/written exclusively by server functions via service_role.';
