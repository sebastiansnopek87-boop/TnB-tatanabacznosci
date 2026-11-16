import { supabase } from "@/integrations/supabase/client";
import type { MeetingDetail, MyReg, PublicMeeting, RegStatus } from "@/lib/meetings";

type ApiError = { message?: unknown };
type InvokeOptions = { allowAnonymous?: boolean };
type ActionData = Record<string, unknown>;

async function invokeMeetings<T>(action: string, data?: ActionData, options: InvokeOptions = {}): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError && !options.allowAnonymous) {
    throw new Error("Nie udało się odczytać sesji. Zaloguj się ponownie.");
  }
  if (!accessToken && !options.allowAnonymous) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }
  const headers: Record<string, string> = {};
  if (accessToken) headers["Authorization"] = "Bearer " + accessToken;
  const body = data === undefined ? { action } : { action, data };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-meetings", { body, headers });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą spotkań.");
  }
  return result as T;
}

export type MeetingRegistrationInput = {
  meetingId: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  consent: true;
  website?: string;
  elapsedMs: number;
};
export type AdminMeetingInput = {
  id: string | null;
  slug: string;
  title: string;
  kind: "online" | "live";
  summary: string;
  description: string;
  rules: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  location_public: boolean;
  capacity: number | null;
  registration_open: boolean;
  requires_login: boolean;
  requires_approval: boolean;
  online_link: string;
  host: string;
  venue_name: string;
  address: string;
  map_url: string;
  equipment: string;
  fee_info: string;
  organizer_contact: string;
  cancellation_policy: string;
  is_outdoor: boolean;
  route_length: string;
  route_duration: string;
  difficulty: "" | "latwa" | "srednia" | "trudna";
  meeting_point: string;
  preparation: string;
  org_notes: string;
  join_open_minutes: number;
  user_can_cancel: boolean;
  recording_url: string;
  recording_access: "participants" | "public";
};

export function listMeetings(): Promise<PublicMeeting[]> {
  return invokeMeetings<PublicMeeting[]>("listMeetings", undefined, { allowAnonymous: true });
}
export function getMeeting({ data }: { data: { slug: string } }): Promise<MeetingDetail | null> {
  return invokeMeetings<MeetingDetail | null>("getMeeting", data, { allowAnonymous: true });
}
export function getMyRegistration({ data }: { data: { meetingId: string } }): Promise<MyReg | null> {
  return invokeMeetings<MyReg | null>("getMyRegistration", data);
}
export type MyMeetingRegistration = {
  id: string;
  title: string;
  slug: string | null;
  kind: "online" | "live";
  starts_at: string;
  ends_at: string | null;
  meetingCancelled: boolean;
  ended: boolean;
} & MyReg;
export function listMyRegistrations(): Promise<MyMeetingRegistration[]> {
  return invokeMeetings<MyMeetingRegistration[]>("listMyRegistrations");
}
export function cancelMyRegistration({ data }: { data: { token: string } }): Promise<{ ok: true } | { error: string }> {
  return invokeMeetings("cancelMyRegistration", data, { allowAnonymous: true });
}
export function registerForMeeting({ data }: { data: MeetingRegistrationInput }): Promise<{ token: string; status: string } | { error: string }> {
  return invokeMeetings("registerForMeeting", data as unknown as ActionData, { allowAnonymous: true });
}
export function getRegistrationByToken({ data }: { data: { token: string } }): Promise<{
  status: RegStatus;
  token: string;
  link: string | null;
  joinOpensAt: string | null;
  recording: string | null;
  address: string | null;
  meeting_point: string | null;
  map_url: string | null;
  canCancel: boolean;
  name: string;
  title: string;
  slug: string | null;
  kind: "online" | "live";
  starts_at: string;
  ends_at: string | null;
  meetingCancelled: boolean;
  cancel_reason: string | null;
  ended: boolean;
  location: string | null;
} | null> {
  return invokeMeetings("getRegistrationByToken", data, { allowAnonymous: true });
}
export type AdminMeetingSummary = {
  id: string;
  slug: string;
  title: string;
  kind: "online" | "live";
  status: "draft" | "published" | "archived";
  starts_at: string;
  capacity: number | null;
  registration_open: boolean;
  cancelled_at: string | null;
  is_outdoor: boolean;
  online_link: string | null;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};
export function adminListMeetings(): Promise<AdminMeetingSummary[]> {
  return invokeMeetings("adminListMeetings");
}
export function adminGetMeeting({ data }: { data: { id: string } }): Promise<AdminMeetingInput & Record<string, unknown>> {
  return invokeMeetings("adminGetMeeting", data);
}
export function adminSaveMeeting({ data }: { data: AdminMeetingInput }): Promise<{ id: string }> {
  return invokeMeetings("adminSaveMeeting", data as unknown as ActionData);
}
export function adminSetMeetingStatus({ data }: { data: { id: string; status: "draft" | "published" | "archived" } }): Promise<{ ok: true }> {
  return invokeMeetings("adminSetMeetingStatus", data);
}
export function adminUploadMeetingImage({ data }: { data: { id: string; name: string; type: string; base64: string } }): Promise<{ ok: true }> {
  return invokeMeetings("adminUploadMeetingImage", data as unknown as ActionData);
}
export function adminRemoveMeetingImage({ data }: { data: { id: string } }): Promise<{ ok: true }> {
  return invokeMeetings("adminRemoveMeetingImage", data);
}
export type AdminMeetingRegistration = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  attended: boolean;
  user_id: string | null;
  created_at: string;
  decided_at: string | null;
};
export function adminListRegistrations({ data }: { data: { meetingId: string } }): Promise<AdminMeetingRegistration[]> {
  return invokeMeetings("adminListRegistrations", data);
}
export function adminUpdateRegistration({ data }: { data: { id: string; status?: "pending" | "approved" | "rejected" | "cancelled"; attended?: boolean } }): Promise<{ ok: true }> {
  return invokeMeetings("adminUpdateRegistration", data);
}
export function adminCancelMeeting({ data }: { data: { id: string; reason: string } }): Promise<{ ok: true; affected: number }> {
  return invokeMeetings("adminCancelMeeting", data);
}
