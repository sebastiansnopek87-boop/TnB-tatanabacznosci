-- platform_settings may be read by anonymous and authenticated visitors,
-- but private billing data must only be available through the server-side admin API.
-- Replace broad table SELECT with an explicit allowlist matching PUBLIC_COLS.
REVOKE SELECT ON TABLE public.platform_settings
FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id,
  platform_name,
  contact_email,
  support_email,
  notice_enabled,
  maintenance_enabled,
  maintenance_message,
  social_youtube,
  social_spotify,
  social_tiktok,
  social_instagram,
  podcast_layout,
  module_visibility,
  brand_settings,
  visual_effects,
  company_legal_name,
  company_legal_form,
  company_nip,
  company_regon,
  company_krs,
  company_address_street,
  company_address_postal,
  company_address_city,
  company_address_country,
  contact_phone,
  contact_hours,
  footer_description,
  footer_copyright,
  footer_show_contact
)
ON TABLE public.platform_settings
TO anon, authenticated;
