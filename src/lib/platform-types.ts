import type { ModuleVisibility } from "@/config/modules";

export type PublicPlatformSettings = {
  platform_name: string;
  contact_email: string | null;
  support_email: string | null;
  notice_enabled: boolean;
  maintenance_enabled: boolean;
  maintenance_message: string;
  social_youtube: string | null;
  social_spotify: string | null;
  social_tiktok: string | null;
  social_instagram: string | null;
  podcast_layout?: string;
  module_visibility?: ModuleVisibility;
  brand_settings?: Record<string, string | boolean>;
  visual_effects?: VisualEffects;
  company_legal_name?: string | null;
  company_legal_form?: string | null;
  company_nip?: string | null;
  company_regon?: string | null;
  company_krs?: string | null;
  company_address_street?: string | null;
  company_address_postal?: string | null;
  company_address_city?: string | null;
  company_address_country?: string | null;
  contact_phone?: string | null;
  contact_hours?: string | null;
  footer_description?: string | null;
  footer_copyright?: string | null;
  footer_show_contact?: boolean;
};

export type BillingSettings = {
  billing_same_as_company: boolean;
  billing_name: string | null;
  billing_nip: string | null;
  billing_address: string | null;
};

export type PodcastLayout = "list" | "grid";

export type VisualEffects = {
  enabled: boolean;
  intensity: "subtle" | "standard" | "off";
  speed: "fast" | "standard" | "calm";
  reveal: boolean;
  interactive: boolean;
  panels: boolean;
};
