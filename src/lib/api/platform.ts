import { supabase } from "@/integrations/supabase/client";
import type { ModuleVisibility } from "@/config/modules";
import type {
  BillingSettings,
  PodcastLayout,
  PublicPlatformSettings,
  VisualEffects,
} from "@/lib/platform.functions";

type PlatformEmailSettings = {
  notification_recipient: string | null;
  sender_name: string | null;
  sender_local_part: string | null;
  sender_domain: string | null;
  contact_notifications_enabled: boolean;
  newsletter_notifications_enabled: boolean;
  newsletter_double_opt_in: boolean;
};

type PlatformSettingsResult = {
  settings: PublicPlatformSettings & BillingSettings & { updated_at: string };
  email: PlatformEmailSettings | null;
  canEdit: boolean;
};

type SecurityCheck = {
  key: string;
  label: string;
  state: "ok" | "warn" | "unverified";
  detail: string;
};

type SecurityEvent = {
  id: string;
  created_at: string;
  type: string;
  actor: string | null;
  object_kind: string | null;
  object_id: string | null;
  result: string;
  detail: string | null;
  actor_email: string | null;
};

type SecurityStatus = { checks: SecurityCheck[]; events: SecurityEvent[] };
type EdgeErrorBody = { message?: unknown; error?: unknown };

const PUBLIC_PLATFORM_COLUMNS =
  "platform_name, contact_email, support_email, notice_enabled, maintenance_enabled, maintenance_message, social_youtube, social_spotify, social_tiktok, social_instagram, podcast_layout, module_visibility, brand_settings, visual_effects, company_legal_name, company_legal_form, company_nip, company_regon, company_krs, company_address_street, company_address_postal, company_address_city, company_address_country, contact_phone, contact_hours, footer_description, footer_copyright, footer_show_contact";

async function invokePlatform<T>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error("Nie udało się odczytać sesji. Zaloguj się ponownie.");
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  const { data, error } = await supabase.functions.invoke<T>("tnb-platform", {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as EdgeErrorBody | null;
      if (payload && typeof payload.message === "string" && payload.message.trim()) {
        throw new Error(payload.message);
      }
    }
    throw new Error(error.message || "Nie udało się połączyć z ustawieniami platformy.");
  }

  if (data === null) {
    throw new Error("Usługa ustawień platformy zwróciła pustą odpowiedź.");
  }

  return data;
}

/** Public, allowlisted settings read through the database's column-level grants and RLS. */
export async function getPublicPlatformSettings(): Promise<PublicPlatformSettings | null> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select(PUBLIC_PLATFORM_COLUMNS)
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error("Nie udało się pobrać publicznych ustawień platformy.");
  return (data ?? null) as PublicPlatformSettings | null;
}

/** Administrative settings are read only after the Edge Function verifies the user's role. */
export function getPlatformSettings(): Promise<PlatformSettingsResult> {
  return invokePlatform<PlatformSettingsResult>({ action: "getPlatformSettings" });
}

export function updatePlatformSettings({ data }: { data: unknown }): Promise<{ ok: true }> {
  return invokePlatform({ action: "updatePlatformSettings", settings: data });
}

export function setVisualEffects({ data }: { data: { effects: VisualEffects } }): Promise<{ ok: true }> {
  return invokePlatform({ action: "setVisualEffects", effects: data.effects });
}

export function setModuleVisibility({ data }: { data: { visibility: ModuleVisibility } }): Promise<{ ok: true }> {
  return invokePlatform({ action: "setModuleVisibility", visibility: data.visibility });
}

/** Public podcast layout is part of the public platform settings allowlist. */
export async function getPodcastLayout(): Promise<PodcastLayout> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("podcast_layout")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error("Nie udało się pobrać układu odcinków.");
  return data?.podcast_layout === "grid" ? "grid" : "list";
}

export function setPodcastLayout({ data }: { data: { layout: PodcastLayout } }): Promise<{ ok: true }> {
  return invokePlatform({ action: "setPodcastLayout", layout: data.layout });
}

export function getSecurityStatus(): Promise<SecurityStatus> {
  return invokePlatform<SecurityStatus>({ action: "getSecurityStatus" });
}
