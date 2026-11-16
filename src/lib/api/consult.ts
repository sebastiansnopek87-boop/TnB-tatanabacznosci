import { supabase } from "@/integrations/supabase/client";

type ApiError = { message?: unknown };
type InvokeOptions = { allowAnonymous?: boolean };
type ActionData = Record<string, unknown>;

async function invokeConsult<T>(action: string, data?: ActionData, options: InvokeOptions = {}): Promise<T> {
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
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-consult", { body, headers });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą konsultacji.");
  }
  return result as T;
}

export type ConsultSlotDay = { date: string; slots: string[] };
export type ConsultBookingInput = {
  startsAt: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  topic: string;
  reason: string;
  question: string;
  consent: true;
  website?: string;
  elapsedMs: number;
};
export type MyConsultBooking = {
  id: string;
  booking_number: string;
  starts_at: string;
  ends_at: string;
  topic: string;
  status: string;
  meeting_link: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};
export type AdminConsultBooking = {
  id: string;
  booking_number: string;
  starts_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  topic: string;
  reason: string;
  status: string;
  confirmation_status: string;
  reminder_status: string;
  cancel_reason: string | null;
  meeting_link: string | null;
};

export function getConsultSlots(): Promise<ConsultSlotDay[]> {
  return invokeConsult<ConsultSlotDay[]>("getConsultSlots", undefined, { allowAnonymous: true });
}
export function createConsultBooking({ data }: { data: ConsultBookingInput }): Promise<{ token: string }> {
  return invokeConsult<{ token: string }>("createConsultBooking", data as unknown as ActionData, { allowAnonymous: true });
}
export function getBookingByToken({ data }: { data: { token: string } }): Promise<{
  number: string; starts_at: string; ends_at: string; status: string; confirmation: string;
  link: string | null; first_name: string; account: boolean;
} | null> {
  return invokeConsult<{
    number: string; starts_at: string; ends_at: string; status: string; confirmation: string;
    link: string | null; first_name: string; account: boolean;
  } | null>("getBookingByToken", data, { allowAnonymous: true });
}
export function listMyBookings(): Promise<MyConsultBooking[]> {
  return invokeConsult<MyConsultBooking[]>("listMyBookings");
}
export function cancelMyBooking({ data }: { data: { id: string; reason: string; other?: string } }): Promise<{ ok: true }> {
  return invokeConsult<{ ok: true }>("cancelMyBooking", data);
}
export function adminListBookings({ data }: { data: { from: string | null; to: string | null; status: string | null } }): Promise<AdminConsultBooking[]> {
  return invokeConsult<AdminConsultBooking[]>("adminListBookings", data);
}
export function adminGetBooking({ data }: { data: { id: string } }): Promise<{ booking: Record<string, unknown>; events: Array<{ type: string; detail: string | null; created_at: string }> }> {
  return invokeConsult("adminGetBooking", data);
}
export function adminUpdateBooking({ data }: { data: { id: string; action: "cancel" | "completed" | "no_show" | "set_link"; link?: string; reason?: string } }): Promise<{ ok: true }> {
  return invokeConsult("adminUpdateBooking", data);
}
export function adminGetAvailability(): Promise<{
  intervals: Array<{ id: string; weekday: number; start_time: string; end_time: string; active: boolean }>;
  blocked: Array<{ day: string; reason: string | null }>;
  defaultLink: string;
}> {
  return invokeConsult("adminGetAvailability");
}
export function adminSaveAvailability({ data }: { data: {
  intervals: Array<{ weekday: number; start_time: string; end_time: string; active: boolean }>;
  defaultLink: string;
} }): Promise<{ ok: true }> {
  return invokeConsult("adminSaveAvailability", data as unknown as ActionData);
}
export function adminBlockDate({ data }: { data: { day: string; reason?: string; remove?: boolean } }): Promise<{ ok: true }> {
  return invokeConsult("adminBlockDate", data);
}
