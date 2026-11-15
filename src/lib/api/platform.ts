import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { ModuleVisibility } from "@/config/modules";
import { invokeEdge } from "./_invoke";

export type PublicPlatformSettings = {
  platform_name: string; contact_email: string | null; support_email: string | null;
  notice_enabled: boolean; maintenance_enabled: boolean; maintenance_message: string;
  social_youtube: string | null; social_spotify: string | null; social_tiktok: string | null; social_instagram: string | null;
  podcast_layout?: string;
  module_visibility?: ModuleVisibility;
  brand_settings?: Record<string, string | boolean>;
  visual_effects?: VisualEffects;
  company_legal_name?: string | null; company_legal_form?: string | null;
  company_nip?: string | null; company_regon?: string | null; company_krs?: string | null;
  company_address_street?: string | null; company_address_postal?: string | null;
  company_address_city?: string | null; company_address_country?: string | null;
  contact_phone?: string | null; contact_hours?: string | null;
  footer_description?: string | null; footer_copyright?: string | null; footer_show_contact?: boolean;
};

export type BillingSettings = {
  billing_same_as_company: boolean;
  billing_name: string | null;
  billing_nip: string | null;
  billing_address: string | null;
};

export const PUBLIC_COLS = "platform_name, contact_email, support_email, notice_enabled, maintenance_enabled, maintenance_message, social_youtube, social_spotify, social_tiktok, social_instagram, podcast_layout, module_visibility, brand_settings, visual_effects, company_legal_name, company_legal_form, company_nip, company_regon, company_krs, company_address_street, company_address_postal, company_address_city, company_address_country, contact_phone, contact_hours, footer_description, footer_copyright, footer_show_contact";

const optEmail = z.union([z.string().trim().email("Podaj poprawny adres e-mail").max(255), z.literal("")]).transform((v) => v === "" ? null : v);
const optUrl = z.union([z.string().trim().url("Podaj pełny adres zaczynający się od https://").max(500).refine((v) => v.startsWith("https://"), "Adres musi zaczynać się od https://"), z.literal("")]).transform((v) => v === "" ? null : v);
const optText = (max: number) => z.union([z.string().trim().max(max), z.literal("")]).transform((v) => v === "" ? null : v);
const optNip = z.union([z.string().trim().regex(/^\d{10}$/, "NIP musi mieć dokładnie 10 cyfr (bez myślników)"), z.literal("")]).transform((v) => v === "" ? null : v);
const optRegon = z.union([z.string().trim().regex(/^\d{9}(\d{5})?$/, "REGON musi mieć 9 lub 14 cyfr"), z.literal("")]).transform((v) => v === "" ? null : v);
const optKrs = z.union([z.string().trim().regex(/^\d{10}$/, "KRS musi mieć dokładnie 10 cyfr"), z.literal("")]).transform((v) => v === "" ? null : v);
const optPostal = z.union([z.string().trim().regex(/^\d{2}-\d{3}$/, "Kod pocztowy w formacie 00-000"), z.literal("")]).transform((v) => v === "" ? null : v);
const optPhone = z.union([z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/, "Podaj poprawny numer telefonu"), z.literal("")]).transform((v) => v === "" ? null : v);

export const platformSchema = z.object({
  social_youtube: optUrl, social_spotify: optUrl, social_tiktok: optUrl, social_instagram: optUrl,
  platform_name: z.string().trim().min(1, "Podaj nazwę platformy").max(100),
  contact_email: optEmail,
  support_email: optEmail,
  notice_enabled: z.boolean(),
  maintenance_enabled: z.boolean(),
  maintenance_message: z.string().trim().max(500, "Komunikat może mieć najwyżej 500 znaków"),
  company_legal_name: optText(200),
  company_legal_form: optText(100),
  company_nip: optNip,
  company_regon: optRegon,
  company_krs: optKrs,
  company_address_street: optText(200),
  company_address_postal: optPostal,
  company_address_city: optText(100),
  company_address_country: optText(100),
  contact_phone: optPhone,
  contact_hours: optText(200),
  billing_same_as_company: z.boolean(),
  billing_name: optText(200),
  billing_nip: optNip,
  billing_address: optText(300),
  footer_description: optText(500),
  footer_copyright: optText(200),
  footer_show_contact: z.boolean(),
}).refine((d) => !(d.notice_enabled || d.maintenance_enabled) || d.maintenance_message.length > 0, {
  message: "Wpisz treść komunikatu, zanim go włączysz.", path: ["maintenance_message"],
}).refine((d) => d.billing_same_as_company || !!d.billing_name, {
  message: "Podaj nazwę nabywcy na fakturze albo włącz kopiowanie danych podmiotu.", path: ["billing_name"],
});

export type PlatformSettingsInput = z.infer<typeof platformSchema>;
export type PodcastLayout = "list" | "grid";
export type VisualEffects = {
  enabled: boolean;
  intensity: "subtle" | "standard" | "off";
  speed: "fast" | "standard" | "calm";
  reveal: boolean;
  interactive: boolean;
  panels: boolean;
};
export const VISUAL_EFFECTS_DEFAULT: VisualEffects = {
  enabled: true, intensity: "subtle", speed: "standard", reveal: true, interactive: true, panels: true,
};

export type AdminPlatformSettings = {
  settings: PublicPlatformSettings & BillingSettings & { updated_at: string };
  email: {
    notification_recipient: string | null;
    sender_name: string;
    sender_local_part: string;
    sender_domain: string;
    contact_notifications_enabled: boolean;
    newsletter_notifications_enabled: boolean;
    newsletter_double_opt_in: boolean;
  } | null;
  canEdit: boolean;
};

export type SecurityStatus = {
  checks: { key: string; label: string; state: "ok" | "warn" | "unverified"; detail: string }[];
  events: {
    id: string; created_at: string; type: string; actor: string | null; object_kind: string | null;
    object_id: string | null; result: string; detail: string | null; actor_email: string | null;
  }[];
};

export async function getPublicPlatformSettings(): Promise<PublicPlatformSettings | null> {
  const { data } = await supabase.from("platform_settings").select(PUBLIC_COLS).eq("id", 1).maybeSingle();
  return (data ?? null) as unknown as PublicPlatformSettings | null;
}

export async function getPlatformSettings(): Promise<AdminPlatformSettings> {
  return invokeEdge("tnb-platform", { action: "getPlatformSettings" });
}

export async function updatePlatformSettings(input: PlatformSettingsInput): Promise<{ ok: true }> {
  const settings = platformSchema.parse(input);
  return invokeEdge("tnb-platform", { action: "updatePlatformSettings", settings });
}

export async function setVisualEffects(input: { effects: VisualEffects }): Promise<{ ok: true }> {
  return invokeEdge("tnb-platform", { action: "setVisualEffects", effects: input.effects });
}

export async function setModuleVisibility(input: { visibility: ModuleVisibility }): Promise<{ ok: true }> {
  return invokeEdge("tnb-platform", { action: "setModuleVisibility", visibility: input.visibility });
}

export async function getPodcastLayout(): Promise<PodcastLayout> {
  const settings = await getPublicPlatformSettings();
  return settings?.podcast_layout === "grid" ? "grid" : "list";
}

export async function setPodcastLayout(input: { layout: PodcastLayout }): Promise<{ ok: true }> {
  return invokeEdge("tnb-platform", { action: "setPodcastLayout", layout: input.layout });
}

export async function getSecurityStatus(): Promise<SecurityStatus> {
  return invokeEdge("tnb-platform", { action: "getSecurityStatus" });
}
