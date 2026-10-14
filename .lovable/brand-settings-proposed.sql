CREATE FUNCTION public.brand_settings_are_public(_value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT CASE WHEN jsonb_typeof(_value) = 'object' THEN
    octet_length(_value::text) <= 12000
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(_value) AS item(key, value)
      WHERE CASE
        WHEN key IN ('logo', 'favicon', 'og_image', 'header_image') THEN
          NOT (
            jsonb_typeof(value) = 'string'
            AND (value #>> '{}') ~ '^brand/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|ico)$'
          )
        WHEN key = 'header_size' THEN
          NOT (jsonb_typeof(value) = 'string'
            AND (value #>> '{}') IN ('small', 'medium', 'large', 'very_large'))
        WHEN key IN ('site_name', 'public_title') THEN
          NOT (jsonb_typeof(value) = 'string'
            AND char_length(value #>> '{}') BETWEEN 1 AND 200)
        WHEN key = 'public_description' THEN
          NOT (jsonb_typeof(value) = 'string'
            AND char_length(value #>> '{}') BETWEEN 1 AND 2000)
        WHEN key = 'site_url' THEN
          NOT (jsonb_typeof(value) = 'string'
            AND char_length(value #>> '{}') <= 500
            AND (value #>> '{}') ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(/[A-Za-z0-9._~/-]*)?$')
        ELSE true
      END
    )
  ELSE false END;
$$;

REVOKE ALL ON FUNCTION public.brand_settings_are_public(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brand_settings_are_public(jsonb)
  TO anon, authenticated, service_role;

ALTER TABLE public.platform_settings
  ADD COLUMN brand_settings jsonb NOT NULL DEFAULT '{}'::jsonb
  CONSTRAINT platform_settings_brand_public_only
  CHECK (public.brand_settings_are_public(brand_settings));

GRANT SELECT (brand_settings) ON public.platform_settings
  TO anon, authenticated;

COMMENT ON COLUMN public.platform_settings.brand_settings IS
  'PUBLIC DATA ONLY: logo, favicon, og_image, header_image, header_size, site_name, public_title, public_description, site_url. Never store passwords, tokens, API keys, OAuth secrets, SMTP, payment data, private administrator data or any other secrets. Image references point only to validated branding files; never signed URLs. Writes only through a superadmin-authorized, strictly validated and audited server function. Private configuration remains in the existing secure mechanism.';

COMMENT ON FUNCTION public.brand_settings_are_public(jsonb) IS
  'Strict public-branding allowlist: rejects unknown keys, nested objects, wrong types and oversized values. Only controlled branding image references and public HTTPS site URLs without credentials, query strings or fragments are accepted. Public text must never contain secrets; validation cannot determine the meaning of arbitrary text.';