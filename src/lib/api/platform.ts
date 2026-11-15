import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ModuleVisibility } from "@/config/modules";
import { invokeTnbFunction } from "@/lib/api/client";
import type { PublicPlatformSettings, BillingSettings, PodcastLayout, VisualEffects } from "@/lib/platform.functions";

export type { PublicPlatformSettings, BillingSettings, PodcastLayout, VisualEffects };

export const PUBLIC_COLS =
  "platform_name, contact_email, support_email, notice_enabled, maintenance_enabled, maintenance_message, social_youtube, social_spotify, social_tiktok, social_instagram, podcast_layout, module_visibility, brand_settings, visual_effects, company_legal_name, company_legal_form, company_nip, company_regon, company_krs, company_address_street, company_address_postal, company_address_city, company_address_country, contact_phone, contact_hours, footer_description, footer_copyright, footer_show_contact";

export const VISUAL_EFFECTS_DEFAULT: VisualEffects = {
  enabled: true,
  intensity: "subtle",
  speed: "standard",
  reveal: true,
  interactive: true,
  panels: true,
};

type PlatformRow = Database["public"]["Tables"]["platform_settings"]["Row"];
type EmailRow = Database["public"]["Tables"]["email_settings"]["Row"];
type AdminEventRow = Database["public"]["Tables"]["admin_events"]["Row"];

export type AdminPlatformSettings = {
  settings: Omit<PlatformRow, "id" | "updated_by">;
  email: Pick<
    EmailRow,
    | "notification_recipient"
    | "sender_name"
    | "sender_local_part"
    | "sender_domain"
    | "contact_notifications_enabled"
    | "newsletter_notifications_enabled"
    | "newsletter_double_opt_in"
  > | null;
  canEdit: boolean;
};

export type UpdatePlatformSettingsInput = Pick<
  PlatformRow,
  | "platform_name"
  | "contact_email"
  | "support_email"
  | "notice_enabled"
  | "maintenance_enabled"
  | "maintenance_message"
  | "social_youtube"
  | "social_spotify"
  | "social_tiktok"
  | "social_instagram"
  | "company_legal_name"
  | "company_legal_form"
  | "company_nip"
  | "company_regon"
  | "company_krs"
  | "company_address_street"
  | "company_address_postal"
  | "company_address_city"
  | "company_address_country"
  | "contact_phone"
  | "contact_hours"
  | "billing_same_as_company"
  | "billing_name"
  | "billing_nip"
  | "billing_address"
  | "footer_description"
  | "footer_copyright"
  | "footer_show_contact"
>;

export type SecurityCheck = {
  key: string;
  label: string;
  state: "ok" | "warn" | "unverified";
  detail: string;
};

export type SecurityEvent = AdminEventRow & { actor_email: string | null };

export type SecurityStatus = {
  checks: SecurityCheck[];
  events: SecurityEvent[];
};

type ServerCall<T> = { data: T };

export async function getPublicPlatformSettings(): Promise<PublicPlatformSettings | null> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select(PUBLIC_COLS)
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error("Nie udało się pobrać ustawień platformy.");
  return (data ?? null) as PublicPlatformSettings | null;
}

export async function getPlatformSettings(): Promise<AdminPlatformSettings> {
  return invokeTnbFunction<AdminPlatformSettings>("tnb-platform", {
    action: "getPlatformSettings",
  });
}

export function updatePlatformSettings({ data }: ServerCall<UpdatePlatformSettingsInput>): Promise<{ ok: true }> {
  return invokeTnbFunction<{ ok: true }>("tnb-platform", {
    action: "updatePlatformSettings",
    settings: data,
  });
}

export function setVisualEffects({ data }: ServerCall<{ effects: VisualEffects }>): Promise<{ ok: true }> {
  return invokeTnbFunction<{ ok: true }>("tnb-platform", {
    action: "setVisualEffects",
    effects: data.effects,
  });
}

export function setModuleVisibility({ data }: ServerCall<{ visibility: ModuleVisibility }>): Promise<{ ok: true }> {
  return invokeTnbFunction<{ ok: true }>("tnb-platform", {
    action: "setModuleVisibility",
    visibility: data.visibility,
  });
}

export async function getPodcastLayout(): Promise<PodcastLayout> {
  const settings = await getPublicPlatformSettings();
  return settings?.podcast_layout === "grid" ? "grid" : "list";
}

export function setPodcastLayout({ data }: ServerCall<{ layout: PodcastLayout }>): Promise<{ ok: true }> {
  return invokeTnbFunction<{ ok: true }>("tnb-platform", {
    action: "setPodcastLayout",
    layout: data.layout,
  });
}

export function getSecurityStatus(): Promise<SecurityStatus> {
  return invokeTnbFunction<SecurityStatus>("tnb-platform", {
    action: "getSecurityStatus",
  });
}
