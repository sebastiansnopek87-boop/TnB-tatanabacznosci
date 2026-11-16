import { supabase } from "@/integrations/supabase/client";

type Input<T> = { data: T };
type BookingInput = {
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
  elapsedMs?: number;
};
type BookingListInput = { from: string | null; to: string | null; status: string | null };
type BookingUpdateInput = { id: string; action: "cancel" | "completed" | "no_show" | "set_link"; link?: string; reason?: string };
type AvailabilityInput = { intervals: Array<{ weekday: number; start_time: string; end_time: string; active: boolean }>; defaultLink: string };
type BlockDateInput = { day: string; reason?: string; remove?: boolean };

export type ConsultBooking = {
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
export type ConsultAvailability = {
  intervals: Array<{ id: string; weekday: number; start_time: string; end_time: string; active: boolean }>;
  blocked: Array<{ day: string; reason: string | null }>;
  defaultLink: string;
};
export type ConsultBookingDetail = {
  booking: {
    id: string;
    booking_number: string;
    starts_at: string;
    ends_at: string;
    status: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    user_id: string | null;
    confirmation_status: string;
    confirmation_error: string | null;
    reminder_status: string;
    topic: string;
    reason: string;
    question: string;
    cancel_reason: string | null;
    cancelled_at: string | null;
    meeting_link: string | null;
  };
  events: Array<{ type: string; detail: string | null; created_at: string }>;
};

async function invoke<T>(action: string, data?: unknown): Promise<T> {
  const body = data === undefined ? { action } : { action, data };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-consult", { body });
  if (error) throw error;
  return result as T;
}

export const getConsultSlots = () => invoke<Array<{ date: string; slots: string[] }>>("getConsultSlots");
export const createConsultBooking = ({ data }: Input<BookingInput>) => invoke<{ token: string }>("createConsultBooking", data);
export const getBookingByToken = ({ data }: Input<{ token: string }>) => invoke<{
  number: string; starts_at: string; ends_at: string; status: string; confirmation: string;
  link: string | null; first_name: string; account: boolean;
} | null>("getBookingByToken", data);
export const listMyBookings = () => invoke<Array<{
  id: string; booking_number: string; starts_at: string; ends_at: string; topic: string;
  status: string; meeting_link: string | null; cancelled_at: string | null; cancel_reason: string | null;
}>>("listMyBookings");
export const cancelMyBooking = ({ data }: Input<{ id: string; reason: string; other?: string }>) =>
  invoke<{ ok: true }>("cancelMyBooking", data);
export const adminListBookings = ({ data }: Input<BookingListInput>) =>
  invoke<ConsultBooking[]>("adminListBookings", data);
export const adminGetBooking = ({ data }: Input<{ id: string }>) =>
  invoke<ConsultBookingDetail>("adminGetBooking", data);
export const adminUpdateBooking = ({ data }: Input<BookingUpdateInput>) =>
  invoke<{ ok: true }>("adminUpdateBooking", data);
export const adminGetAvailability = () => invoke<ConsultAvailability>("adminGetAvailability");
export const adminSaveAvailability = ({ data }: Input<AvailabilityInput>) =>
  invoke<{ ok: true }>("adminSaveAvailability", data);
export const adminBlockDate = ({ data }: Input<BlockDateInput>) =>
  invoke<{ ok: true }>("adminBlockDate", data);
