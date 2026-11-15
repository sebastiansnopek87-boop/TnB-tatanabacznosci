import { supabase } from "@/integrations/supabase/client";
import type { EventDef } from "@/lib/notify/registry";

type NotificationApiError = { message?: unknown };
export type DispatchResult = { status: "sent" | "simulated" | "skipped" | "failed" | "duplicate"; id?: string; reason?: string };
export type NotificationTemplate = { key: string; required: string[]; subject: string; html: string; text: string; custom: boolean };
export type NotificationTemplateInput = { key: string; subject: string; html: string; text: string };
export type NotificationOverview = {
  canEdit: boolean;
  provider: { name: string; connected: boolean; domainStatus: "verified" | "pending" };
  settings: { sender: string; sender_name: string; reply_to: string | null; delivery_mode: "test" | "live"; recipient: string | null };
  events: Array<EventDef & { enabled: boolean; customized: boolean }>;
};

async function invokeNotifications<T>(action: string, data?: unknown): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-notifications", {
    body: data === undefined ? { action } : { action, data },
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as NotificationApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą powiadomień.");
  }
  if (result === null) throw new Error("Usługa powiadomień zwróciła pustą odpowiedź.");
  return result as T;
}

export function getNotificationOverview(): Promise<NotificationOverview> {
  return invokeNotifications("getNotificationOverview");
}
export function getTemplate({ data }: { data: { key: string } }): Promise<NotificationTemplate> {
  return invokeNotifications("getTemplate", data);
}
export function previewTemplate({ data }: { data: NotificationTemplateInput & { vars?: Record<string, string> } }): Promise<
  { ok: true; subject: string; html: string; text: string; usesSensitive: boolean } | { ok: false; missing: string[] }
> {
  return invokeNotifications("previewTemplate", data);
}
export function saveTemplate({ data }: { data: NotificationTemplateInput }): Promise<{ ok: true }> {
  return invokeNotifications("saveTemplate", data);
}
export function resetTemplate({ data }: { data: { key: string } }): Promise<{ ok: true }> {
  return invokeNotifications("resetTemplate", data);
}
export function setEventEnabled({ data }: { data: { key: string; enabled: boolean } }): Promise<{ ok: true }> {
  return invokeNotifications("setEventEnabled", data);
}
export function updateDeliveryConfig({ data }: { data: { reply_to: string | null; delivery_mode: "test" | "live" } }): Promise<{ ok: true }> {
  return invokeNotifications("updateDeliveryConfig", data);
}
export function sendTestMessage({ data }: { data: { key: string; to: string; vars?: Record<string, string> } }): Promise<DispatchResult> {
  return invokeNotifications("sendTestMessage", data);
}
export function runDuplicateCheck(): Promise<{ first: DispatchResult["status"]; second: DispatchResult["status"] }> {
  return invokeNotifications("runDuplicateCheck");
}
export function retryNotification({ data }: { data: { id: string } }): Promise<DispatchResult> {
  return invokeNotifications("retryNotification", data);
}
export function getLogPreview({ data }: { data: { id: string } }): Promise<{
  rendered_subject: string | null; rendered_html: string | null; rendered_text: string | null; mode: string;
}> {
  return invokeNotifications("getLogPreview", data);
}
