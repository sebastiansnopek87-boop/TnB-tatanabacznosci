import { assertAdmin } from "./admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CANCEL_REASONS, SLOT_MINUTES, addDays, canUserCancel, warsawToUtc } from "./consult";

// Booking data (topics, descriptions, contact details) never leaves the server except to the admin
// or to the booking's own user (RLS: user_id = auth.uid()) / token holder (limited fields, no topic).
const srv = () => import("./consult.server");
type Ctx = { supabase: any; userId: string };
async function optionalUser() {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.split(".").length !== 3) return null;
  const { data } = await (await (await srv()).db()).auth.getUser(token);
  return data.user ?? null;
}

export const getConsultSlots = createServerFn({ method: "GET" }).handler(async () => (await srv()).computeSlots());

const CONSENT = "Zapoznałem(-am) się z informacją o przetwarzaniu danych. Moje dane i opis rozmowy służą wyłącznie organizacji i przygotowaniu rozmowy 1:1 i nie są publicznie widoczne.";
const txt = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max, `Maksymalnie ${max} znaków.`);

export const createConsultBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    startsAt: z.string().datetime(),
    first_name: txt(1, 60, "Podaj imię."),
    last_name: txt(1, 80, "Podaj nazwisko."),
    email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
    phone: z.string().trim().max(20).regex(/^$|^\+?[0-9 ()-]{7,20}$/, "Podaj poprawny numer telefonu.").default(""),
    topic: txt(3, 150, "Podaj temat rozmowy (min. 3 znaki)."),
    reason: txt(3, 2000, "Opisz krótko, co skłoniło Cię do umówienia rozmowy."),
    question: txt(3, 2000, "Podaj zagadnienie lub pytanie do rozmowy."),
    consent: z.literal(true, { errorMap: () => ({ message: "Potwierdź zapoznanie się z informacją o przetwarzaniu danych." }) }),
    website: z.string().max(200).default(""),
    elapsedMs: z.number().int().min(0).default(0),
  }).parse(d))
  .handler(async ({ data }) => {
    const { db, computeSlots, logEvent, sendBookingMail } = await srv();
    if (data.website || data.elapsedMs < 3000) throw new Error("Nie udało się wysłać formularza. Spróbuj ponownie.");
    const s = await db();
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await s.from("consult_bookings").select("id", { count: "exact", head: true }).eq("email", data.email).gte("created_at", hourAgo);
    if ((count ?? 0) >= 3) throw new Error("Zbyt wiele rezerwacji z tego adresu. Spróbuj ponownie później.");
    const { count: active } = await s.from("consult_bookings").select("id", { count: "exact", head: true }).eq("email", data.email).eq("status", "booked").gt("starts_at", new Date().toISOString());
    if ((active ?? 0) >= 2) throw new Error("Masz już zaplanowane rozmowy. Kolejną możesz zarezerwować po ich odbyciu lub anulowaniu.");
    const start = new Date(data.startsAt);
    const valid = (await computeSlots()).some((d) => d.slots.includes(start.toISOString()));
    if (!valid) throw new Error("Ten termin jest już niedostępny. Wybierz inny.");
    const user = await optionalUser();
    const { data: st } = await s.from("consult_settings").select("default_meeting_link").eq("id", 1).maybeSingle();
    const { data: b, error } = await s.from("consult_bookings").insert({
      starts_at: start.toISOString(), ends_at: new Date(start.getTime() + SLOT_MINUTES * 60_000).toISOString(), user_id: user?.id ?? null,
      first_name: data.first_name, last_name: data.last_name, email: data.email, phone: data.phone || null,
      topic: data.topic, reason: data.reason, question: data.question, consent_text: CONSENT, meeting_link: st?.default_meeting_link ?? null,
    }).select("id, booking_number, first_name, email, starts_at, meeting_link, access_token, user_id").single();
    if (error) {
      if (error.code === "23P01") throw new Error("Ten termin został przed chwilą zarezerwowany przez kogoś innego. Wybierz inny.");
      throw new Error("Nie udało się zapisać rezerwacji.");
    }
    await logEvent(b.id, "created", user ? "Rezerwacja z konta użytkownika." : "Rezerwacja bez konta.", user?.id ?? null);
    const r = await sendBookingMail("confirmation", b);
    await s.from("consult_bookings").update({ confirmation_status: r.ok ? "sent" : "skipped", confirmation_error: r.ok ? null : r.reason }).eq("id", b.id);
    await logEvent(b.id, r.ok ? "confirmation_sent" : "confirmation_skipped", r.ok ? null : r.reason);
    await sendBookingMail("admin_new", b);
    return { token: b.access_token as string };
  });

// Confirmation page for the token holder — no topic/description, no other people's data.
export const getBookingByToken = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { db } = await srv();
    const { data: b } = await (await db()).from("consult_bookings")
      .select("booking_number, starts_at, ends_at, status, confirmation_status, meeting_link, first_name, user_id").eq("access_token", data.token).maybeSingle();
    if (!b) return null;
    return { number: b.booking_number, starts_at: b.starts_at, ends_at: b.ends_at, status: b.status, confirmation: b.confirmation_status,
      link: b.status === "booked" ? b.meeting_link : null, first_name: b.first_name, account: !!b.user_id };
  });

export const listMyBookings = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("consult_bookings")
    .select("id, booking_number, starts_at, ends_at, topic, status, meeting_link, cancelled_at, cancel_reason")
    .eq("user_id", context.userId).order("starts_at", { ascending: false }).limit(50);
  if (error) throw new Error("Nie udało się pobrać spotkań.");
  return (data ?? []).map((b: any) => ({ ...b, meeting_link: b.status === "booked" ? b.meeting_link : null }));
});

export const cancelMyBooking = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.enum(CANCEL_REASONS), other: z.string().trim().max(400).default("") })
    .refine((v) => v.reason !== "Inny powód" || v.other.length >= 3, { message: "Wpisz krótkie wyjaśnienie.", path: ["other"] }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, logEvent, sendBookingMail } = await srv();
    const { data: own } = await context.supabase.from("consult_bookings").select("id, status, starts_at").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!own) throw new Error("Nie znaleziono rezerwacji.");
    if (own.status !== "booked") throw new Error("Tej rezerwacji nie można już anulować.");
    if (!canUserCancel(own.starts_at)) throw new Error("Do rozmowy zostało mniej niż 2 godziny. Termin możesz odwołać wyłącznie przez kontakt z organizatorem.");
    const reason = data.reason === "Inny powód" ? `Inny powód: ${data.other}` : data.reason;
    const s = await db();
    const now = new Date().toISOString();
    const { data: b, error } = await s.from("consult_bookings").update({
      status: "cancelled_user", cancelled_at: now, cancel_reason: reason, cancelled_by: context.userId, status_changed_by: context.userId, status_changed_at: now, reminder_status: "not_needed",
    }).eq("id", data.id).eq("status", "booked").select("id, booking_number, first_name, email, starts_at, meeting_link, access_token, user_id").maybeSingle();
    if (error || !b) throw new Error("Nie udało się anulować rezerwacji.");
    await logEvent(b.id, "cancelled_user", reason, context.userId);
    await sendBookingMail("cancelled_user", b);
    await sendBookingMail("admin_cancelled", b);
    return { ok: true };
  });

// ---------- admin ----------
export const adminListBookings = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), status: z.string().max(30).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("consult_bookings")
      .select("id, booking_number, starts_at, first_name, last_name, email, phone, topic, reason, status, confirmation_status, reminder_status, cancel_reason, meeting_link")
      .order("starts_at", { ascending: true }).limit(500);
    if (data.from) q = q.gte("starts_at", warsawToUtc(data.from, "00:00").toISOString());
    if (data.to) q = q.lt("starts_at", warsawToUtc(addDays(data.to, 1), "00:00").toISOString());
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać rezerwacji.");
    return rows as any[];
  });

export const adminGetBooking = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: b } = await context.supabase.from("consult_bookings").select("*").eq("id", data.id).maybeSingle();
    if (!b) throw new Error("Nie znaleziono rezerwacji.");
    const { data: ev } = await context.supabase.from("consult_booking_events").select("type, detail, created_at").eq("booking_id", data.id).order("created_at");
    return { booking: b as any, events: (ev ?? []) as any[] };
  });

export const adminUpdateBooking = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), action: z.enum(["cancel", "completed", "no_show", "set_link"]),
    link: z.string().trim().max(500).refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Link musi zaczynać się od https://").default(""),
    reason: z.string().trim().max(400).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { db, logEvent, sendBookingMail } = await srv();
    const s = await db();
    const now = new Date().toISOString();
    const COLS = "id, booking_number, first_name, email, starts_at, meeting_link, access_token, user_id, status";
    const { data: cur } = await s.from("consult_bookings").select(COLS).eq("id", data.id).maybeSingle();
    if (!cur) throw new Error("Nie znaleziono rezerwacji.");
    if (data.action === "set_link") {
      await s.from("consult_bookings").update({ meeting_link: data.link || null }).eq("id", data.id);
      await logEvent(data.id, "link_changed", data.link || "Usunięto link", context.userId);
      return { ok: true };
    }
    if (cur.status !== "booked") throw new Error("Ta rezerwacja ma już status końcowy.");
    const status = data.action === "cancel" ? "cancelled_admin" : data.action;
    const patch: Record<string, string | null> & { status: string } = { status, status_changed_by: context.userId, status_changed_at: now };
    if (status === "cancelled_admin") Object.assign(patch, { cancelled_at: now, cancelled_by: context.userId, cancel_reason: data.reason || "Anulowane przez organizatora", reminder_status: "not_needed" });
    const { error } = await s.from("consult_bookings").update(patch as any).eq("id", data.id).eq("status", "booked");
    if (error) throw new Error("Nie udało się zmienić statusu.");
    await logEvent(data.id, status, data.reason || null, context.userId);
    if (status === "cancelled_admin") await sendBookingMail("cancelled_admin", cur);
    return { ok: true };
  });

export const adminGetAvailability = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const [{ data: av }, { data: bl }, { data: st }] = await Promise.all([
    context.supabase.from("consult_availability").select("id, weekday, start_time, end_time, active").order("weekday").order("start_time"),
    context.supabase.from("consult_blocked_dates").select("day, reason").gte("day", new Date().toISOString().slice(0, 10)).order("day"),
    context.supabase.from("consult_settings").select("default_meeting_link").eq("id", 1).maybeSingle(),
  ]);
  return { intervals: (av ?? []) as any[], blocked: (bl ?? []) as any[], defaultLink: (st?.default_meeting_link ?? "") as string };
});

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Godzina w formacie GG:MM.");
export const adminSaveAvailability = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    intervals: z.array(z.object({ weekday: z.number().int().min(1).max(7), start_time: hm, end_time: hm, active: z.boolean() })).max(70),
    defaultLink: z.string().trim().max(500).refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Link musi zaczynać się od https://"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const norm = data.intervals.map((i) => ({ ...i, start_time: i.start_time.slice(0, 5), end_time: i.end_time.slice(0, 5) }));
    for (const i of norm) if (i.end_time <= i.start_time) throw new Error("Godzina zakończenia musi być późniejsza niż rozpoczęcia.");
    for (const a of norm) for (const b of norm) if (a !== b && a.weekday === b.weekday && a.start_time < b.end_time && b.start_time < a.end_time) throw new Error("Przedziały w jednym dniu nie mogą na siebie nachodzić.");
    const del = await context.supabase.from("consult_availability").delete().not("id", "is", null);
    if (del.error) throw new Error("Nie udało się zapisać dostępności.");
    if (norm.length) { const ins = await context.supabase.from("consult_availability").insert(norm); if (ins.error) throw new Error("Nie udało się zapisać dostępności."); }
    const up = await context.supabase.from("consult_settings").update({ default_meeting_link: data.defaultLink || null, updated_at: new Date().toISOString() }).eq("id", 1);
    if (up.error) throw new Error("Nie udało się zapisać linku.");
    return { ok: true };
  });

export const adminBlockDate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().trim().max(200).default(""), remove: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const r = data.remove
      ? await context.supabase.from("consult_blocked_dates").delete().eq("day", data.day)
      : await context.supabase.from("consult_blocked_dates").upsert({ day: data.day, reason: data.reason });
    if (r.error) throw new Error("Nie udało się zapisać blokady.");
    return { ok: true };
  });
