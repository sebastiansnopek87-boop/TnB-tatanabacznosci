import { supabase } from "@/integrations/supabase/client";
import type { PublicPlatformSettings } from "@/lib/platform.functions";

// These are the columns explicitly granted to anon/authenticated by migration 0063.
// Billing fields and internal audit metadata are deliberately excluded.
const PUBLIC_PLATFORM_COLUMNS =
  "platform_name, contact_email, support_email, notice_enabled, maintenance_enabled, maintenance_message, social_youtube, social_spotify, social_tiktok, social_instagram, podcast_layout, module_visibility, brand_settings, visual_effects, company_legal_name, company_legal_form, company_nip, company_regon, company_krs, company_address_street, company_address_postal, company_address_city, company_address_country, contact_phone, contact_hours, footer_description, footer_copyright, footer_show_contact";

export * from "@/lib/platform.functions";

// Public settings are read directly under the table's public SELECT policy.
// No server function or service-role client is needed for this restricted projection.
export async function getPublicPlatformSettings(): Promise<PublicPlatformSettings | null> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select(PUBLIC_PLATFORM_COLUMNS)
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error("Nie udało się pobrać publicznych ustawień platformy.");
  }

  return (data ?? null) as PublicPlatformSettings | null;
}
