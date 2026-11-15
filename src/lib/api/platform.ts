import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/edge";
import type { ModuleVisibility } from "@/config/modules";
import type {
  BillingSettings,
  PodcastLayout,
  PublicPlatformSettings,
  VisualEffects,
} from "@/lib/platform.functions";

const PUBLIC_COLS =
  "platform_name, contact_email, support_email, notice_enabled, maintenance_enabled, maintenance_message, social_youtube, social_spotify, social_tiktok, social_instagram, podcast_layout, module_visibility, brand_settings, visual_effects, company_legal_name, company_legal_form, company_nip, company_regon, company_krs, company_address_street, company_address_postal, company_address_city, company_address_country, contact_phone, contact_hours, footer_description, footer_copyright, footer_show_contact";

export type PlatformAdminSettings = {
  settings: PublicPlatformSettings & BillingSettings & { updated_at: string };
  email: {
    notification_recipient: string | null;
    sender_name: string | null;
    sender_local_part: string | null;
    sender_domain: string | null;
    contact_notifications_enabled: boolean;
    newsletter_notifications_enabled: boolean;
    newsletter_double_opt_in: boolean;
  } | null;
  canEdit: boolean;
};

export type SecurityCheck = {
  key: string;
  label: string;
  state: "ok" | "warn" | "unverified";
  detail: string;
};

export type SecurityEvent = {
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

export async function getPublicPlatformSettings(): Promise<PublicPlatformSettings | null> {
  const { data } = await supabase
    .from("platform_settings")
    .select(PUBLIC_COLS)
    .eq("id", 1)
    .maybeSingle();

  return (data ?? null) as unknown as PublicPlatformSettings | null;
}

export function getPlatformSettings(): Promise<PlatformAdminSettings> {
  return invokeEdge("tnb-platform", { action: "getPlatformSettings" });
}

export function updatePlatformSettings({
  data,
}: {
  data: Record<string, unknown>;
}): Promise<{ ok: true }> {
  return invokeEdge("tnb-platform", { action: "updatePlatformSettings", settings: data });
}

export function setVisualEffects({
  data,
}: {
  data: { effects: VisualEffects };
}): Promise<{ ok: true }> {
  return invokeEdge("tnb-platform", { action: "setVisualEffects", effects: data.effects });
}

export function setModuleVisibility({
  data,
}: {
  data: { visibility: ModuleVisibility };
}): Promise<{ ok: true }> {
  return invokeEdge("tnb-platform", { action: "setModuleVisibility", visibility: data.visibility });
}

export async function getPodcastLayout(): Promise<PodcastLayout> {
  const settings = await getPublicPlatformSettings();
  return settings?.podcast_layout === "grid" ? "grid" : "list";
}

export function setPodcastLayout({
  data,
}: {
  data: { layout: PodcastLayout };
}): Promise<{ ok: true }> {
  return invokeEdge("tnb-platform", { action: "setPodcastLayout", layout: data.layout });
}

export function getSecurityStatus(): Promise<{
  checks: SecurityCheck[];
  events: SecurityEvent[];
}> {
  return invokeEdge("tnb-platform", { action: "getSecurityStatus" });
}
