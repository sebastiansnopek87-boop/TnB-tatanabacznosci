import { invokeTnbFunction } from "@/lib/api/client";
import type { Database } from "@/integrations/supabase/types";

// The remaining functions are still server-backed during the staged migration.
export {
  PUBLIC_COLS,
  getPublicPlatformSettings,
  platformSchema,
  VISUAL_EFFECTS_DEFAULT,
  setVisualEffects,
  setModuleVisibility,
  getPodcastLayout,
  setPodcastLayout,
  getSecurityStatus,
} from "@/lib/platform.functions";
export type {
  PublicPlatformSettings,
  BillingSettings,
  PodcastLayout,
  VisualEffects,
} from "@/lib/platform.functions";

type PlatformRow = Database["public"]["Tables"]["platform_settings"]["Row"];
type EmailRow = Database["public"]["Tables"]["email_settings"]["Row"];

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

export function getPlatformSettings(): Promise<AdminPlatformSettings> {
  return invokeTnbFunction<AdminPlatformSettings>("tnb-platform", {
    action: "getPlatformSettings",
  });
}

export function updatePlatformSettings({ data }: { data: UpdatePlatformSettingsInput }): Promise<{ ok: true }> {
  return invokeTnbFunction<{ ok: true }>("tnb-platform", {
    action: "updatePlatformSettings",
    settings: data,
  });
}
