import type { Tables } from "@/integrations/supabase/types";

export type PodcastLayout = "list" | "grid";
export type VisualEffects = {
  enabled: boolean;
  intensity: "subtle" | "standard" | "off";
  speed: "fast" | "standard" | "calm";
  reveal: boolean;
  interactive: boolean;
  panels: boolean;
};

export type PublicPlatformSettings = Pick<
  Tables<"platform_settings">,
  | "platform_name" | "contact_email" | "support_email"
  | "notice_enabled" | "maintenance_enabled" | "maintenance_message"
  | "social_youtube" | "social_spotify" | "social_tiktok" | "social_instagram"
  | "podcast_layout" | "module_visibility" | "brand_settings" | "visual_effects"
  | "company_legal_name" | "company_legal_form" | "company_nip" | "company_regon" | "company_krs"
  | "company_address_street" | "company_address_postal" | "company_address_city" | "company_address_country"
  | "contact_phone" | "contact_hours" | "footer_description" | "footer_copyright" | "footer_show_contact"
>;

export type BillingSettings = Pick<
  Tables<"platform_settings">,
  "billing_same_as_company" | "billing_name" | "billing_nip" | "billing_address"
>;
