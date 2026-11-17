CREATE OR REPLACE FUNCTION public.brand_settings_are_public(_value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog'
AS $function$
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
        WHEN key = 'slogan' THEN
          NOT (jsonb_typeof(value) = 'string'
            AND char_length(value #>> '{}') <= 200)
        WHEN key = 'show_slogan' THEN
          jsonb_typeof(value) <> 'boolean'
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
$function$;