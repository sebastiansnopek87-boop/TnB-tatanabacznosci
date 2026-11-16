import { supabase } from "@/integrations/supabase/client";
import type { MeetingDetail, MyReg, PublicMeeting, RegStatus } from "@/lib/meetings";

type Input<T> = { data: T };
type MeetingSaveInput = {
  id: string | null; slug: string; title: string; kind: "online" | "live";
  summary: string; description: string; rules: string; starts_at: string; ends_at: string | null;
  location: string; location_public: boolean; capacity: number | null; registration_open: boolean;
  requires_login: boolean; requires_approval: boolean; online_link: string; host: string; venue_name: string;
  address: string; map_url: string; equipment: string; fee_info: string; organizer_contact: string;
  cancellation_policy: string; is_outdoor: boolean; route_length: string; route_duration: string;
  difficulty: "" | "latwa" | "srednia" | "trudna"; meeting_point: string; preparation: string; org_notes: string;
  join_open_minutes: number; user_can_cancel: boolean; recording_url: string;
  recording_access: "participants" | "public";
};

async function invoke<T>(action: string, data?: unknown): Promise<T> {
  const body = data === undefined ? { action } : { action, data };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-meetings", { body });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as { message?: unknown } | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą spotkań.");
  }
  return result as T;
}

export const listMeetings = () => invoke<PublicMeeting[]>("listMeetings");
export const getMeeting = ({ data }: Input<{ slug: string }>) => invoke<MeetingDetail | null>("getMeeting", data);
export const getMyRegistration = ({ data }: Input<{ meetingId: string }>) => invoke<MyReg | null>("getMyRegistration", data);
export const listMyRegistrations = () => invoke<Array<MyReg & {
  id: string; title: string; slug: string | null; kind: string; starts_at: string; ends_at: string | null;
  meetingCancelled: boolean; ended: boolean;
}>>("listMyRegistrations");
export const cancelMyRegistration = ({ data }: Input<{ token: string }>) =>
  invoke<{ ok: true } | { error: string }>("cancelMyRegistration", data);
export const registerForMeeting = ({ data }: Input<{
  meetingId: string; name: string; email: string; phone?: string; message?: string; consent: true;
  website?: string; elapsedMs?: number;
}>) => invoke<{ token: string; status: string } | { error: string }>("registerForMeeting", data);
export const getRegistrationByToken = ({ data }: Input<{ token: string }>) => invoke<(
  MyReg & { name: string; title: string; slug: string | null; kind: string; starts_at: string; ends_at: string | null;
    meetingCancelled: boolean; cancel_reason: string | null; ended: boolean; location: string | null }
) | null>("getRegistrationByToken", data);

export const adminListMeetings = () => invoke<Array<{
  id: string; slug: string; title: string; kind: string; status: string; starts_at: string; capacity: number | null;
  registration_open: boolean; cancelled_at: string | null; is_outdoor: boolean; online_link: string | null;
  total: number; pending: number; approved: number; rejected: number;
}>>("adminListMeetings");
export const adminGetMeeting = ({ data }: Input<{ id: string }>) => invoke<Record<string, any>>("adminGetMeeting", data);
export const adminSaveMeeting = ({ data }: Input<MeetingSaveInput>) => invoke<{ id: string }>("adminSaveMeeting", data);
export const adminSetMeetingStatus = ({ data }: Input<{ id: string; status: "draft" | "published" | "archived" }>) =>
  invoke<{ ok: true }>("adminSetMeetingStatus", data);
export const adminUploadMeetingImage = ({ data }: Input<{ id: string; name: string; type: string; base64: string }>) =>
  invoke<{ ok: true }>("adminUploadMeetingImage", data);
export const adminRemoveMeetingImage = ({ data }: Input<{ id: string }>) => invoke<{ ok: true }>("adminRemoveMeetingImage", data);
export const adminListRegistrations = ({ data }: Input<{ meetingId: string }>) => invoke<Array<{
  id: string; name: string; email: string; phone: string | null; message: string | null; status: RegStatus;
  attended: boolean; user_id: string | null; created_at: string; decided_at: string | null;
}>>("adminListRegistrations", data);
export const adminUpdateRegistration = ({ data }: Input<{ id: string; status?: RegStatus; attended?: boolean }>) =>
  invoke<{ ok: true }>("adminUpdateRegistration", data);
export const adminCancelMeeting = ({ data }: Input<{ id: string; reason: string }>) =>
  invoke<{ ok: true; affected: number }>("adminCancelMeeting", data);
