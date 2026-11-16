import { siteOrigin } from "./orders.server";
import { HORIZON_DAYS, MIN_NOTICE_HOURS, SLOT_MINUTES, addDays, fmtDate, fmtHm, isoWeekday, warsawToUtc, warsawYmd } from "./consult";

export const db = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/** Free slots grouped by Warsaw date. Contains no data about who booked what. */
export async function computeSlots(now = new Date()): Promise<{ date: string; slots: string[] }[]> {
  const s = await db();
  const today = warsawYmd(now);
  const last = addDays(today, HORIZON_DAYS);
  const [{ data: av }, { data: blocked }, { data: booked }] = await Promise.all([
    s.from("consult_availability").select("weekday, start_time, end_time").eq("active", true),
    s.from("consult_blocked_dates").select("day").gte("day", today).lte("day", last),
    s.from("consult_bookings").select("starts_at, ends_at").eq("status", "booked").gte("ends_at", now.toISOString()),
  ]);
  const blockedSet = new Set((blocked ?? []).map((b) => b.day));
  const taken = (booked ?? []).map((b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()] as const);
  const minStart = now.getTime() + MIN_NOTICE_HOURS * 3600_000;
  const out: { date: string; slots: string[] }[] = [];
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    const day = addDays(today, i);
    if (blockedSet.has(day)) continue;
    const wd = isoWeekday(day);
    const set = new Set<string>();
    for (const a of (av ?? []).filter((x) => x.weekday === wd)) {
      const [sh, sm] = a.start_time.split(":").map(Number);
      const [eh, em] = a.end_time.split(":").map(Number);
      for (let m = sh! * 60 + sm!; m + SLOT_MINUTES <= eh! * 60 + em!; m += SLOT_MINUTES) {
        const start = warsawToUtc(day, `${Math.floor(m / 60)}:${m % 60}`);
        const t = start.getTime(), e = t + SLOT_MINUTES * 60_000;
        if (t < minStart) continue;
        if (warsawYmd(start) !== day) continue; // non-existent local time on DST switch
        if (taken.some(([bs, be]) => t < be && e > bs)) continue;
        set.add(start.toISOString());
      }
    }
    if (set.size) out.push({ date: day, slots: [...set].sort() });
  }
  return out;
}

export async function logEvent(bookingId: string, type: string, detail: string | null, actor: string | null = null) {
  await (await db()).from("consult_booking_events").insert({ booking_id: bookingId, type, detail, actor });
}

type Mail = "confirmation" | "reminder" | "cancelled_user" | "cancelled_admin" | "admin_new" | "admin_cancelled";
type B = { id: string; booking_number: string; first_name: string; starts_at: string; meeting_link: string | null; access_token: string; user_id: string | null };

// Booking mails go through the central notification engine (dispatch). The
// meeting link is only passed to templates delivered to the booking owner.
const EVENT: Record<Mail, string | null> = {
  confirmation: "booking_created", reminder: "booking_reminder", cancelled_user: "booking_cancelled",
  cancelled_admin: "booking_cancelled", admin_new: "consult_request_admin", admin_cancelled: null, // no admin template for cancellation yet
};

export async function sendBookingMail(kind: Mail, b: B & { email: string }): Promise<{ ok: true } | { ok: false; reason: string }> {
  const event = EVENT[kind];
  if (!event) return { ok: false, reason: "event_not_integrated" };
  const { dispatch } = await import("./notifications.server");
  const base = { imie: b.first_name, data_spotkania: fmtDate(b.starts_at), godzina_spotkania: fmtHm(b.starts_at) };
  const vars = kind === "admin_new" ? { ...base, email: b.email, link_do_panelu: `${siteOrigin()}/admin/rozmowy` }
    : kind === "reminder" ? { ...base, link_do_spotkania: b.meeting_link || `${siteOrigin()}/spotkania/rezerwacja/${b.access_token}` }
    : base;
  const r = await dispatch({ event, to: b.email, vars, idempotencyKey: `${kind}-${b.id}`, relatedId: b.id });
  return r.status === "sent" ? { ok: true } : { ok: false, reason: r.status === "simulated" ? "simulated" : r.reason ?? r.status };
}

const COLS = "id, booking_number, first_name, email, starts_at, meeting_link, access_token, user_id";

/** Sends 24h reminders for active bookings. Cancelled bookings are never reminded. */
export async function processReminders(now = new Date()) {
  const s = await db();
  const { data } = await s.from("consult_bookings").select(COLS).eq("status", "booked").eq("reminder_status", "pending")
    .gt("starts_at", now.toISOString()).lte("starts_at", new Date(now.getTime() + 24 * 3600_000).toISOString()).limit(100);
  let sent = 0, skipped = 0;
  for (const b of data ?? []) {
    const r = await sendBookingMail("reminder", b);
    await s.from("consult_bookings").update({ reminder_status: r.ok ? "sent" : "skipped", reminder_error: r.ok ? null : r.reason, reminder_at: now.toISOString() }).eq("id", b.id).eq("status", "booked");
    await logEvent(b.id, r.ok ? "reminder_sent" : "reminder_skipped", r.ok ? null : r.reason);
    r.ok ? sent++ : skipped++;
  }
  return { checked: data?.length ?? 0, sent, skipped };
}
