import { supabase } from "@/integrations/supabase/client";
import type { ModuleVisibility } from "@/config/modules";

const PUBLIC_COLS = [
  "platform_name", "contact_email", "support_email", "notice_enabled", "maintenance_enabled",
  "maintenance_message", "social_youtube", "social_spotify", "social_tiktok", "social_instagram",
  "podcast_layout", "module_visibility", "brand_settings", "visual_effects", "company_legal_name",
  "company_legal_form", "company_nip", "company_regon", "company_krs", "company_address_street",
  "company_address_postal", "company_address_city", "company_address_country", "contact_phone",
  "contact_hours", "footer_description", "footer_copyright", "footer_show_contact",
].join(", ");

export type PodcastLayout = "list" | "grid";
export type VisualEffects = {
  enabled: boolean;
  intensity: "subtle" | "standard" | "off";
  speed: "fast" | "standard" | "calm";
  reveal: boolean;
  interactive: boolean;
  panels: boolean;
};
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
  podcast_layout: string | null;
  module_visibility: ModuleVisibility | null;
  brand_settings: Record<string, string | boolean> | null;
  visual_effects: VisualEffects | null;
  company_legal_name: string | null;
  company_legal_form: string | null;
  company_nip: string | null;
  company_regon: string | null;
  company_krs: string | null;
  company_address_street: string | null;
  company_address_postal: string | null;
  company_address_city: string | null;
  company_address_country: string | null;
  contact_phone: string | null;
  contact_hours: string | null;
  footer_description: string | null;
  footer_copyright: string | null;
  footer_show_contact: boolean;
};
export type PlatformSettings = PublicPlatformSettings & {
  billing_same_as_company: boolean;
  billing_name: string | null;
  billing_nip: string | null;
  billing_address: string | null;
  updated_at: string;
};
export type PlatformSettingsInput = {
  social_youtube: string; social_spotify: string; social_tiktok: string; social_instagram: string;
  platform_name: string; contact_email: string; support_email: string;
  notice_enabled: boolean; maintenance_enabled: boolean; maintenance_message: string;
  company_legal_name: string; company_legal_form: string; company_nip: string; company_regon: string; company_krs: string;
  company_address_street: string; company_address_postal: string; company_address_city: string; company_address_country: string;
  contact_phone: string; contact_hours: string; billing_same_as_company: boolean; billing_name: string;
  billing_nip: string; billing_address: string; footer_description: string; footer_copyright: string; footer_show_contact: boolean;
};
export type EmailSettingsSummary = {
  notification_recipient: string | null;
  sender_name: string;
  sender_local_part: string;
  sender_domain: string | null;
  contact_notifications_enabled: boolean;
  newsletter_notifications_enabled: boolean;
  newsletter_double_opt_in: boolean;
};
export type PlatformSettingsResponse = { settings: PlatformSettings; email: EmailSettingsSummary | null; canEdit: boolean };
export type SecurityCheck = { key: string; label: string; state: "ok" | "warn" | "unverified"; detail: string };
export type SecurityEvent = {
  id: string; created_at: string; type: string; actor: string | null; actor_email: string | null;
  object_kind: string | null; object_id: string | null; result: string; detail: string | null;
};
export type SecurityStatus = { checks: SecurityCheck[]; events: SecurityEvent[] };

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("tnb-platform", { body });
  if (error) {
    let message = error.message || "Nie udało się wykonać operacji.";
    const context = (error as Error & { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      try {
        const payload = await context.clone().json() as { message?: unknown };
        if (typeof payload.message === "string" && payload.message.trim()) message = payload.message;
      } catch {
        // Keep the SDK fallback when the response is not JSON.
      }
    }
    throw new Error(message);
  }
  if (data == null) throw new Error("Serwer zwrócił pustą odpowiedź.");
  return data;
}

export async function getPublicPlatformSettings(): Promise<PublicPlatformSettings | null> {
  const { data, error } = await supabase.from("platform_settings").select(PUBLIC_COLS).eq("id", 1).maybeSingle();
  if (error) throw new Error("Nie udało się pobrać ustawień platformy.");
  return data as PublicPlatformSettings | null;
}

export async function getPodcastLayout(): Promise<PodcastLayout> {
  const settings = await getPublicPlatformSettings();
  return settings?.podcast_layout === "grid" ? "grid" : "list";
}

export function getPlatformSettings(): Promise<PlatformSettingsResponse> {
  return invoke<PlatformSettingsResponse>({ action: "getPlatformSettings" });
}

export function updatePlatformSettings(input: { data: PlatformSettingsInput }): Promise<{ ok: true }> {
  return invoke<{ ok: true }>({ action: "updatePlatformSettings", settings: input.data });
}

export function setVisualEffects(input: { data: { effects: VisualEffects } }): Promise<{ ok: true }> {
  return invoke<{ ok: true }>({ action: "setVisualEffects", effects: input.data.effects });
}

export function setModuleVisibility(input: { data: { visibility: ModuleVisibility } }): Promise<{ ok: true }> {
  return invoke<{ ok: true }>({ action: "setModuleVisibility", visibility: input.data.visibility });
}

export function setPodcastLayout(input: { data: { layout: PodcastLayout } }): Promise<{ ok: true }> {
  return invoke<{ ok: true }>({ action: "setPodcastLayout", layout: input.data.layout });
}

export function getSecurityStatus(): Promise<SecurityStatus> {
  return invoke<SecurityStatus>({ action: "getSecurityStatus" });
}
