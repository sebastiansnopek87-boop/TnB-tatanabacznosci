import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { HistoryEvent, ReadState } from "@/lib/control-center";

type MessageFilter = { status?: "all" | "new" | "read" | "archived" | "inbox"; q?: string; sort?: "desc" | "asc" };
type SubscriberFilter = { status?: "all" | "pending" | "active" | "unsubscribed"; q?: string; from?: string; to?: string };
type LogFilter = { kind?: string; status?: "all" | "pending" | "sending" | "sent" | "delivered" | "failed" | "cancelled" | "skipped" | "suppressed" | "simulated" };
type EventFilter = { from?: string; to?: string; category?: string; actor?: string; result?: "" | "ok" | "failed" | "denied"; typeIn?: string[]; q?: string; page?: number };
type EmailSettings = {
  notification_recipient: string | null;
  sender_name: string;
  sender_local_part: string;
  sender_domain: string | null;
  admin_inbox_url: string | null;
  contact_notifications_enabled: boolean;
  newsletter_notifications_enabled: boolean;
  newsletter_double_opt_in: boolean;
  updated_at: string;
};
type Dashboard = {
  usersTotal: number | null; usersNew30: number | null; library: number | null; posts: number | null;
  meetings: number | null; bookings: number | null; orders: number | null; pendingOrders: number | null;
  newMsgs: number | null; reports: number | null; failedMail: number | null; pendingRegs: number | null;
  deniedWeek: number | null; active: number; pending: number; unsub: number; paidTotal: number | null;
  paidCurrency: string; recent: AdminEvent[];
};
type MessageRow = { id: string; name: string; email: string; subject: string; message: string; status: string; created_at: string; read_at: string | null; archived_at: string | null };
type SubscriberRow = {
  id: string; first_name: string | null; email: string; status: string; source: string; consent_text: string; consent_version: string;
  consent_given_at: string; opt_in_method: string; confirmed_at: string | null; unsubscribed_at: string | null;
  subscribe_count: number; created_at: string; updated_at: string;
};
type CommunityPost = {
  id: string; author_name: string; body: string; status: string; visibility: string; created_at: string;
  community_comments: Array<{ id: string; author_name: string; body: string; created_at: string }>;
};
type Report = { id: string; reason: string; status: string; created_at: string; post_id: string; community_posts: { author_name: string; body: string; status: string } | null };
type AdminEvent = { id: string; created_at: string; type: string; actor: string | null; actor_email: string | null; object_kind: string | null; object_id: string | null; result: string; detail: string | null };

type EmailSettingsInput = {
  notification_recipient: string;
  sender_name: string;
  sender_local_part: string;
  sender_domain: string;
  admin_inbox_url: string;
  contact_notifications_enabled: boolean;
  newsletter_notifications_enabled: boolean;
  newsletter_double_opt_in: boolean;
};
const optionalEmail = (schema: z.ZodString) =>
  z.union([schema, z.literal("")]).transform((value) => value === "" ? null : value);
export const emailSettingsSchema = z.object({
  notification_recipient: optionalEmail(z.string().trim().email("Podaj poprawny adres e-mail").max(255)),
  sender_name: z.string().trim().min(1, "Podaj nazwę nadawcy").max(100),
  sender_local_part: z.string().trim().min(1, "Podaj część adresu przed @").max(64)
    .regex(/^[a-z0-9._-]+$/i, "Dozwolone litery, cyfry, kropka, myślnik i podkreślnik"),
  sender_domain: optionalEmail(z.string().trim().toLowerCase().max(253)
    .regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/, "Podaj poprawną domenę, np. powiadomienia.twojadomena.pl")),
  admin_inbox_url: optionalEmail(z.string().trim().url("Podaj pełny adres URL").max(500)),
  contact_notifications_enabled: z.boolean(),
  newsletter_notifications_enabled: z.boolean(),
  newsletter_double_opt_in: z.boolean(),
});

type ModerationInput =
  | { action: "hide" | "restore" | "delete_post"; id: string }
  | { action: "set_visibility"; id: string; visibility: "public" | "community" }
  | { action: "delete_comment"; id: string };

type ApiError = { message?: unknown };

async function invokeAdmin<T>(action: string, data?: unknown): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

  const body = data === undefined ? { action } : { action, data };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-admin", {
    body,
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z panelem administratora.");
  }
  if (result === null) throw new Error("Panel administratora zwrócił pustą odpowiedź.");
  return result as T;
}

// Navigation guard: role is checked with the current authenticated user's RLS context.
export async function getAdminStatus(): Promise<{ isAdmin: boolean; email: string | null }> {
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (roleError) throw new Error("Nie udało się sprawdzić uprawnień administratora.");
  return { isAdmin: !!isAdmin, email: user.email ?? null };
}

export function getDashboard(): Promise<Dashboard> {
  return invokeAdmin("getDashboard");
}
export function listMessages({ data }: { data: MessageFilter }): Promise<MessageRow[]> {
  return invokeAdmin("listMessages", data);
}
export function setMessageStatus({ data }: { data: { id: string; status: "new" | "read" | "archived" } }): Promise<{ ok: true }> {
  return invokeAdmin("setMessageStatus", data);
}
export function listSubscribers({ data }: { data: SubscriberFilter }): Promise<SubscriberRow[]> {
  return invokeAdmin("listSubscribers", data);
}
export function getEmailSettings(): Promise<EmailSettings> {
  return invokeAdmin("getEmailSettings");
}
export function updateEmailSettings({ data }: { data: EmailSettingsInput }): Promise<{ ok: true }> {
  return invokeAdmin("updateEmailSettings", emailSettingsSchema.parse(data));
}
export function listNotificationLog({ data }: { data: LogFilter }): Promise<Array<{
  id: string; kind: string; related_id: string | null; recipient: string | null; status: string; reason: string | null;
  created_at: string; template_key: string | null; mode: string; attempts: number; provider_message_id: string | null;
  retryable: boolean; updated_at: string;
}>> {
  return invokeAdmin("listNotificationLog", data);
}
export function listCommunity({ data }: { data: { status: "all" | "published" | "hidden" } }): Promise<CommunityPost[]> {
  return invokeAdmin("listCommunity", data);
}
export function moderateCommunity({ data }: { data: ModerationInput }): Promise<{ ok: true }> {
  return invokeAdmin("moderateCommunity", data);
}
export function listReports(): Promise<Report[]> {
  return invokeAdmin("listReports");
}
export function resolveReport({ data }: { data: { id: string } }): Promise<{ ok: true }> {
  return invokeAdmin("resolveReport", data);
}
export function listAdminEvents({ data }: { data: EventFilter }): Promise<{
  rows: AdminEvent[]; total: number; pageSize: number; actors: Array<{ id: string; email: string }>;
}> {
  return invokeAdmin("listAdminEvents", data);
}

export type ControlCenterSearchResult = {
  states: { users: ReadState; materials: ReadState; orders: ReadState; requests: ReadState };
  users: Array<{
    id: string; email: string | null; name: string | null; tnbId: string | null;
    roles: string[] | null; confirmed: boolean | null; createdAt: string | null;
  }>;
  materials: Array<{ id: string; slug: string; title: string }>;
  orders: Array<{
    id: string; orderNumber: string; itemId: string; itemTitle: string; itemSlug: string | null;
    createdAt: string; status: string; amount: number; currency: string; isTest: boolean;
    paidAt: string | null; buyerEmail: string; userId: string | null;
    access: { allowed: boolean; expired: boolean; label: string };
    accessExpiresAt: string | null; accessRevokedAt: string | null;
    matches: Array<{ userId: string; kind: "user_id" | "email" }>; warnings: string[];
  }>;
  requests: Array<{
    id: string; itemId: string; itemTitle: string; mode: string; status: string;
    userId: string | null; name: string | null; email: string | null; createdAt: string;
    downloadedAt: string | null; downloadCount: number; notificationStatus: string | null;
    matches: Array<{ userId: string; kind: "user_id" | "email" }>; warnings: string[];
  }>;
};
export type ControlCenterHistoryResult = {
  rows: HistoryEvent[];
  next: { order: number; admin: number; mail: number };
  hasMore: boolean;
  error: string | null;
  before: string;
};
export function controlCenterSearch({ data }: { data: { q: string } }): Promise<ControlCenterSearchResult> {
  return invokeAdmin("controlCenterSearch", data);
}
export function controlCenterHistory({ data }: { data: {
  kind: "order" | "user" | "library_request" | "actor";
  id: string;
  offsets?: { order: number; admin: number; mail?: number };
  before?: string;
} }): Promise<ControlCenterHistoryResult> {
  return invokeAdmin("controlCenterHistory", data);
}
