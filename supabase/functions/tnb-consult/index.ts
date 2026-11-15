import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "zod";
import { EVENT_MAP, DEFAULT_TEMPLATES } from "./registry.ts";
import { render, maskSensitive, stripSensitive, type Vars } from "./render.ts";

const CORS = new Headers({ ...corsHeaders, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version", "Access-Control-Max-Age": "86400", "X-Content-Type-Options": "nosniff" });
const TZ = "Europe/Warsaw";
const SLOT_MINUTES = 30, MIN_NOTICE_HOURS = 2, HORIZON_DAYS = 60, CANCEL_LIMIT_HOURS = 2;
const CANCEL_REASONS = ["Nie mogę uczestniczyć w wybranym terminie.", "Zmieniły się moje plany.", "Problem techniczny lub organizacyjny.", "Potrzebuję innego terminu.", "Inny powód"] as const;
const CONSENT = "Zapoznałem(-am) się z informacją o przetwarzaniu danych. Moje dane i opis rozmowy służą wyłącznie organizacji i przygotowaniu rozmowy 1:1 i nie są publicznie widoczne.";
const EMAIL = /^[^\s@<>"]+@[^\s@<>]+\.[a-z]{2,}$/i;

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: CORS }); }
function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try { const v = JSON.parse(raw); if (typeof v === "string") return v; if (v && typeof v.default === "string") return v.default; }
    catch { return raw; }
  }
  return null;
}
function db() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new HttpError(503, "Usługa konsultacji nie jest skonfigurowana.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
    headers.set("apikey", key); return fetch(input, { ...init, headers });
  } } });
}
type Db = ReturnType<typeof db>;
async function userFromRequest(s: Db, req: Request) {
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await s.auth.getUser(token);
  return !error && data.user ? data.user : null;
}
async function requireUser(s: Db, req: Request) {
  const user = await userFromRequest(s, req);
  if (!user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  return user;
}
async function requireAdmin(s: Db, req: Request) {
  const user = await requireUser(s, req);
  const { data, error } = await s.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (error || !data) {
    await logAdminEvent(s, { type: "access_denied", actor: user.id, objectKind: "consultation", result: "denied" });
    throw new HttpError(403, "Brak uprawnień administratora.");
  }
  return user;
}
async function logAdminEvent(s: Db, e: { type: string; actor?: string | null; objectKind?: string | null; objectId?: string | null; result?: "ok" | "failed" | "denied"; detail?: string | null }) {
  try { await s.from("admin_events").insert({ type: e.type, actor: e.actor ?? null, object_kind: e.objectKind ?? null, object_id: e.objectId ?? null, result: e.result ?? "ok", detail: e.detail?.slice(0, 300) ?? null }); }
  catch (e) { console.error("consult admin event log failed", e); }
}
async function logEvent(s: Db, id: string, type: string, detail: string | null, actor: string | null = null) {
  await s.from("consult_booking_events").insert({ booking_id: id, type, detail, actor });
}

const parts = (d: Date) => {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(d)) if (p.type !== "literal") o[p.type] = Number(p.value);
  return { y: o.year!, m: o.month!, d: o.day!, h: (o.hour ?? 0) % 24, mi: o.minute!, s: o.second! };
};
const offsetMs = (d: Date) => { const p = parts(d); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000; };
function warsawToUtc(ymd: string, hm: string) {
  const [y, m, d] = ymd.split("-").map(Number), [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, h!, mi!);
  let t = guess - offsetMs(new Date(guess));
  t = guess - offsetMs(new Date(t));
  return new Date(t);
}
const warsawYmd = (d: Date) => { const p = parts(d); return p.y + "-" + String(p.m).padStart(2, "0") + "-" + String(p.d).padStart(2, "0"); };
const isoWeekday = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); const w = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay(); return w === 0 ? 7 : w; };
const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10); };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDate = (iso: string) => cap(new Date(iso).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }));
const fmtHm = (iso: string) => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const canUserCancel = (startsAt: string, now = Date.now()) => new Date(startsAt).getTime() - now >= CANCEL_LIMIT_HOURS * 3600_000;

async function computeSlots(s: Db, now = new Date()) {
  const today = warsawYmd(now), last = addDays(today, HORIZON_DAYS);
  const [{ data: av }, { data: blocked }, { data: booked }] = await Promise.all([
    s.from("consult_availability").select("weekday, start_time, end_time").eq("active", true),
    s.from("consult_blocked_dates").select("day").gte("day", today).lte("day", last),
    s.from("consult_bookings").select("starts_at, ends_at").eq("status", "booked").gte("ends_at", now.toISOString())
  ]);
  const blockedSet = new Set((blocked ?? []).map((b: { day: string }) => b.day));
  const taken = (booked ?? []).map((b: { starts_at: string; ends_at: string }) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()] as const);
  const minStart = now.getTime() + MIN_NOTICE_HOURS * 3600_000;
  const out: { date: string; slots: string[] }[] = [];
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    const day = addDays(today, i);
    if (blockedSet.has(day)) continue;
    const wd = isoWeekday(day), set = new Set<string>();
    for (const a of (av ?? []).filter((x: { weekday: number; start_time: string; end_time: string }) => x.weekday === wd)) {
      const [sh, sm] = a.start_time.split(":").map(Number), [eh, em] = a.end_time.split(":").map(Number);
      for (let m = sh! * 60 + sm!; m + SLOT_MINUTES <= eh! * 60 + em!; m += SLOT_MINUTES) {
        const start = warsawToUtc(day, String(Math.floor(m / 60)) + ":" + String(m % 60));
        const t = start.getTime(), e = t + SLOT_MINUTES * 60_000;
        if (t < minStart || warsawYmd(start) !== day || taken.some(([bs, be]) => t < be && e > bs)) continue;
        set.add(start.toISOString());
      }
    }
    if (set.size) out.push({ date: day, slots: [...set].sort() });
  }
  return out;
}

async function notificationContext(s: Db) {
  const [{ data: settings }, { data: platform }] = await Promise.all([
    s.from("email_settings").select("*").eq("id", 1).maybeSingle(),
    s.from("platform_settings").select("platform_name").eq("id", 1).maybeSingle()
  ]);
  return { settings, platform: platform?.platform_name || "Tata Na Baczności" };
}
async function dispatch(s: Db, input: { event: string; to?: string | null; vars: Vars; idempotencyKey: string; relatedId?: string | null }) {
  try {
    const event = EVENT_MAP[input.event];
    if (!event) return { status: "failed" as const, reason: "unknown_event" };
    const { settings, platform } = await notificationContext(s);
    const base = { kind: input.event, related_id: input.relatedId ?? null, template_key: input.event, idempotency_key: input.idempotencyKey };
    const put = async (row: Record<string, unknown>) => {
      const { data, error } = await s.from("email_notification_log").insert({ ...base, mode: "test", ...row }).select("id").single();
      if (error) { if (error.code === "23505") return null; throw error; }
      return data.id as string;
    };
    const enabled = event.integration === "integrated" && (await s.from("notification_rules").select("enabled").eq("event_key", input.event).maybeSingle()).data?.enabled !== false;
    if (!enabled) {
      const id = await put({ status: "skipped", reason: "notification_disabled", recipient: null });
      return id ? { status: "skipped" as const, id, reason: "notification_disabled" } : { status: "duplicate" as const };
    }
    const recipient = (event.recipient === "admin" ? settings?.notification_recipient : input.to)?.trim() ?? "";
    if (!EMAIL.test(recipient)) {
      const id = await put({ status: "skipped", reason: "recipient_not_configured", recipient: recipient || null });
      return id ? { status: "skipped" as const, id, reason: "recipient_not_configured" } : { status: "duplicate" as const };
    }
    const def = DEFAULT_TEMPLATES[input.event];
    if (!def) return { status: "failed" as const, reason: "template_not_found" };
    const { data: custom } = await s.from("email_templates").select("subject, html, text_body").eq("key", input.event).maybeSingle();
    const tpl = { key: input.event, required: def.required, subject: custom?.subject ?? def.subject, html: custom?.html ?? def.html, text: custom?.text_body ?? def.text };
    const vars: Vars = { ...input.vars, nazwa_platformy: platform };
    const r = render(tpl, vars, tpl.required);
    if (!r.ok) {
      const id = await put({ status: "failed", reason: "missing_variables:" + r.missing.join(","), recipient, payload: stripSensitive(input.vars), retryable: true });
      return id ? { status: "failed" as const, id, reason: "missing_variables" } : { status: "duplicate" as const };
    }
    const id = await put({ status: "sending", recipient, payload: stripSensitive(input.vars), retryable: !r.usesSensitive });
    if (!id) return { status: "duplicate" as const };
    const safe = render(tpl, maskSensitive(vars), tpl.required);
    await s.from("email_notification_log").update({ status: "simulated", reason: null, attempts: 1, mode: "test", updated_at: new Date().toISOString(), rendered_subject: safe.ok ? safe.subject : null, rendered_html: safe.ok ? safe.html : null, rendered_text: safe.ok ? safe.text : null }).eq("id", id);
    return { status: "simulated" as const, id };
  } catch (e) { console.error("consult notification failed", e instanceof Error ? e.message : e); return { status: "failed" as const, reason: "internal_error" }; }
}
type BookingMail = "confirmation" | "reminder" | "cancelled_user" | "cancelled_admin" | "admin_new" | "admin_cancelled";
type BookingMailRow = { id: string; booking_number: string; first_name: string; email: string; starts_at: string; meeting_link: string | null; access_token: string; user_id: string | null };
async function sendBookingMail(s: Db, kind: BookingMail, b: BookingMailRow) {
  const event = ({ confirmation: "booking_created", reminder: "booking_reminder", cancelled_user: "booking_cancelled", cancelled_admin: "booking_cancelled", admin_new: "consult_request_admin", admin_cancelled: null } as Record<string, string | null>)[kind];
  if (!event) return { ok: false, reason: "event_not_integrated" };
  const origin = (Deno.env.get("PUBLIC_SITE_URL") || "https://tatanabacznosci.pl").replace(/\/+$/, "");
  const base = { imie: b.first_name, data_spotkania: fmtDate(b.starts_at), godzina_spotkania: fmtHm(b.starts_at) };
  const vars = kind === "admin_new" ? { ...base, email: b.email, link_do_panelu: origin + "/admin/rozmowy" }
    : kind === "reminder" ? { ...base, link_do_spotkania: b.meeting_link || origin + "/spotkania/rezerwacja/" + b.access_token }
    : base;
  const r = await dispatch(s, { event, to: b.email, vars, idempotencyKey: kind + "-" + b.id, relatedId: b.id });
  return r.status === "sent" ? { ok: true } : { ok: false, reason: r.status === "simulated" ? "simulated" : r.reason ?? r.status };
}
const txt = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max, "Maksymalnie " + max + " znaków.");
const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeHm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Godzina w formacie GG:MM.");
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("getConsultSlots") }),
  z.object({ action: z.literal("createConsultBooking"), data: z.object({
    startsAt: z.string().datetime(), first_name: txt(1,60,"Podaj imię."), last_name: txt(1,80,"Podaj nazwisko."),
    email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
    phone: z.string().trim().max(20).regex(/^$|^\+?[0-9 ()-]{7,20}$/,"Podaj poprawny numer telefonu.").default(""),
    topic: txt(3,150,"Podaj temat rozmowy (min. 3 znaki)."), reason: txt(3,2000,"Opisz krótko, co skłoniło Cię do umówienia rozmowy."),
    question: txt(3,2000,"Podaj zagadnienie lub pytanie do rozmowy."),
    consent: z.literal(true, { errorMap: () => ({ message: "Potwierdź zapoznanie się z informacją o przetwarzaniu danych." }) }),
    website: z.string().max(200).default(""), elapsedMs: z.number().int().min(0).default(0)
  }) }),
  z.object({ action: z.literal("getBookingByToken"), data: z.object({ token: z.string().uuid() }) }),
  z.object({ action: z.literal("listMyBookings") }),
  z.object({ action: z.literal("cancelMyBooking"), data: z.object({ id: z.string().uuid(), reason: z.enum(CANCEL_REASONS), other: z.string().trim().max(400).default("") }).refine(v => v.reason !== "Inny powód" || v.other.length >= 3, { message: "Wpisz krótkie wyjaśnienie.", path: ["other"] }) }),
  z.object({ action: z.literal("adminListBookings"), data: z.object({ from: dateYmd.nullable(), to: dateYmd.nullable(), status: z.string().max(30).nullable() }) }),
  z.object({ action: z.literal("adminGetBooking"), data: z.object({ id: z.string().uuid() }) }),
  z.object({ action: z.literal("adminUpdateBooking"), data: z.object({ id: z.string().uuid(), action: z.enum(["cancel","completed","no_show","set_link"]), link: z.string().trim().max(500).refine(v => v === "" || /^https:\/\/\S+$/.test(v), "Link musi zaczynać się od https://").default(""), reason: z.string().trim().max(400).default("") }) }),
  z.object({ action: z.literal("adminGetAvailability") }),
  z.object({ action: z.literal("adminSaveAvailability"), data: z.object({ intervals: z.array(z.object({ weekday:z.number().int().min(1).max(7), start_time:timeHm, end_time:timeHm, active:z.boolean() })).max(70), defaultLink:z.string().trim().max(500).refine(v=>v==="" || /^https:\/\/\S+$/.test(v),"Link musi zaczynać się od https://") }) }),
  z.object({ action: z.literal("adminBlockDate"), data: z.object({ day: dateYmd, reason:z.string().trim().max(200).default(""), remove:z.boolean().default(false) }) })
]);
const ADMIN_ACTIONS = new Set(["adminListBookings","adminGetBooking","adminUpdateBooking","adminGetAvailability","adminSaveAvailability","adminBlockDate"]);
const AUTH_ACTIONS = new Set(["listMyBookings","cancelMyBooking"]);
async function handle(s: Db, req: Request, raw: unknown) {
  const input = RequestSchema.parse(raw);
  const actor = ADMIN_ACTIONS.has(input.action) ? await requireAdmin(s, req) : AUTH_ACTIONS.has(input.action) ? await requireUser(s, req) : null;
  switch (input.action) {
    case "getConsultSlots": return await computeSlots(s);
    case "createConsultBooking": {
      const d = input.data;
      if (d.website || d.elapsedMs < 3000) throw new HttpError(400, "Nie udało się wysłać formularza. Spróbuj ponownie.");
      const hourAgo = new Date(Date.now()-3600000).toISOString();
      const { count } = await s.from("consult_bookings").select("id",{count:"exact",head:true}).eq("email",d.email).gte("created_at",hourAgo);
      if ((count ?? 0) >= 3) throw new HttpError(429,"Zbyt wiele rezerwacji z tego adresu. Spróbuj ponownie później.");
      const { count: active } = await s.from("consult_bookings").select("id",{count:"exact",head:true}).eq("email",d.email).eq("status","booked").gt("starts_at",new Date().toISOString());
      if ((active ?? 0) >= 2) throw new HttpError(409,"Masz już zaplanowane rozmowy. Kolejną możesz zarezerwować po ich odbyciu lub anulowaniu.");
      const start = new Date(d.startsAt);
      const valid = (await computeSlots(s)).some(day => day.slots.includes(start.toISOString()));
      if (!valid) throw new HttpError(409,"Ten termin jest już niedostępny. Wybierz inny.");
      const user = await userFromRequest(s,req);
      const { data: settings } = await s.from("consult_settings").select("default_meeting_link").eq("id",1).maybeSingle();
      const { data: b, error } = await s.from("consult_bookings").insert({
        starts_at:start.toISOString(), ends_at:new Date(start.getTime()+SLOT_MINUTES*60000).toISOString(), user_id:user?.id ?? null,
        first_name:d.first_name,last_name:d.last_name,email:d.email,phone:d.phone || null,topic:d.topic,reason:d.reason,question:d.question,
        consent_text:CONSENT,meeting_link:settings?.default_meeting_link ?? null
      }).select("id, booking_number, first_name, email, starts_at, meeting_link, access_token, user_id").single();
      if (error) throw new HttpError(error.code==="23P01"?409:500,error.code==="23P01"?"Ten termin został przed chwilą zarezerwowany przez kogoś innego. Wybierz inny.":"Nie udało się zapisać rezerwacji.");
      await logEvent(s,b.id,"created",user?"Rezerwacja z konta użytkownika.":"Rezerwacja bez konta.",user?.id ?? null);
      const mail = await sendBookingMail(s,"confirmation",b);
      await s.from("consult_bookings").update({confirmation_status:mail.ok?"sent":"skipped",confirmation_error:mail.ok?null:mail.reason}).eq("id",b.id);
      await logEvent(s,b.id,mail.ok?"confirmation_sent":"confirmation_skipped",mail.ok?null:mail.reason);
      await sendBookingMail(s,"admin_new",b);
      return { token:b.access_token };
    }
    case "getBookingByToken": {
      const { data: b } = await s.from("consult_bookings").select("booking_number, starts_at, ends_at, status, confirmation_status, meeting_link, first_name, user_id").eq("access_token",input.data.token).maybeSingle();
      if (!b) return null;
      return { number:b.booking_number,starts_at:b.starts_at,ends_at:b.ends_at,status:b.status,confirmation:b.confirmation_status,link:b.status==="booked"?b.meeting_link:null,first_name:b.first_name,account:!!b.user_id };
    }
    case "listMyBookings": {
      const { data,error } = await s.from("consult_bookings").select("id, booking_number, starts_at, ends_at, topic, status, meeting_link, cancelled_at, cancel_reason").eq("user_id",actor!.id).order("starts_at",{ascending:false}).limit(50);
      if (error) throw new HttpError(500,"Nie udało się pobrać spotkań.");
      return (data ?? []).map((b: { id: string; booking_number: string; starts_at: string; ends_at: string; topic: string; status: string; meeting_link: string | null; cancelled_at: string | null; cancel_reason: string | null })=>({...b,meeting_link:b.status==="booked"?b.meeting_link:null}));
    }
    case "cancelMyBooking": {
      const d=input.data;
      const { data: own } = await s.from("consult_bookings").select("id,status,starts_at").eq("id",d.id).eq("user_id",actor!.id).maybeSingle();
      if (!own) throw new HttpError(404,"Nie znaleziono rezerwacji.");
      if (own.status!=="booked") throw new HttpError(409,"Tej rezerwacji nie można już anulować.");
      if (!canUserCancel(own.starts_at)) throw new HttpError(409,"Do rozmowy zostało mniej niż 2 godziny. Termin możesz odwołać wyłącznie przez kontakt z organizatorem.");
      const reason=d.reason==="Inny powód"?"Inny powód: "+d.other:d.reason, now=new Date().toISOString();
      const { data:b,error } = await s.from("consult_bookings").update({status:"cancelled_user",cancelled_at:now,cancel_reason:reason,cancelled_by:actor!.id,status_changed_by:actor!.id,status_changed_at:now,reminder_status:"not_needed"})
        .eq("id",d.id).eq("status","booked").select("id,booking_number,first_name,email,starts_at,meeting_link,access_token,user_id").maybeSingle();
      if (error || !b) throw new HttpError(409,"Nie udało się anulować rezerwacji.");
      await logEvent(s,b.id,"cancelled_user",reason,actor!.id);
      await sendBookingMail(s,"cancelled_user",b); await sendBookingMail(s,"admin_cancelled",b);
      return {ok:true};
    }
    case "adminListBookings": {
      const d=input.data; let q=s.from("consult_bookings").select("id, booking_number, starts_at, first_name, last_name, email, phone, topic, reason, status, confirmation_status, reminder_status, cancel_reason, meeting_link").order("starts_at",{ascending:true}).limit(500);
      if(d.from) q=q.gte("starts_at",warsawToUtc(d.from,"00:00").toISOString());
      if(d.to) q=q.lt("starts_at",warsawToUtc(addDays(d.to,1),"00:00").toISOString());
      if(d.status) q=q.eq("status",d.status);
      const {data,error}=await q; if(error) throw new HttpError(500,"Nie udało się pobrać rezerwacji."); return data ?? [];
    }
    case "adminGetBooking": {
      const {data:b}=await s.from("consult_bookings").select("*").eq("id",input.data.id).maybeSingle();
      if(!b) throw new HttpError(404,"Nie znaleziono rezerwacji.");
      const {data:ev}=await s.from("consult_booking_events").select("type,detail,created_at").eq("booking_id",input.data.id).order("created_at");
      return {booking:b,events:ev ?? []};
    }
    case "adminUpdateBooking": {
      const d=input.data, now=new Date().toISOString(), cols="id, booking_number, first_name, email, starts_at, meeting_link, access_token, user_id, status";
      const {data:cur}=await s.from("consult_bookings").select(cols).eq("id",d.id).maybeSingle();
      if(!cur) throw new HttpError(404,"Nie znaleziono rezerwacji.");
      if(d.action==="set_link") {
        const {error}=await s.from("consult_bookings").update({meeting_link:d.link || null}).eq("id",d.id);
        if(error) throw new HttpError(500,"Nie udało się zapisać linku.");
        await logEvent(s,d.id,"link_changed",d.link || "Usunięto link",actor!.id);
        await logAdminEvent(s,{type:"booking_link_changed",actor:actor!.id,objectKind:"booking",objectId:d.id,detail:cur.booking_number});
        return {ok:true};
      }
      if(cur.status!=="booked") throw new HttpError(409,"Ta rezerwacja ma już status końcowy.");
      const status=d.action==="cancel"?"cancelled_admin":d.action;
      const patch: { status: string; status_changed_by: string; status_changed_at: string; cancelled_at?: string; cancelled_by?: string; cancel_reason?: string; reminder_status?: string }={status,status_changed_by:actor!.id,status_changed_at:now};
      if(status==="cancelled_admin") Object.assign(patch,{cancelled_at:now,cancelled_by:actor!.id,cancel_reason:d.reason || "Anulowane przez organizatora",reminder_status:"not_needed"});
      const {error}=await s.from("consult_bookings").update(patch).eq("id",d.id).eq("status","booked");
      await logAdminEvent(s,{type:"booking_"+status,actor:actor!.id,objectKind:"booking",objectId:d.id,result:error?"failed":"ok",detail:cur.booking_number});
      if(error) throw new HttpError(500,"Nie udało się zmienić statusu.");
      await logEvent(s,d.id,status,d.reason || null,actor!.id);
      if(status==="cancelled_admin") await sendBookingMail(s,"cancelled_admin",cur);
      return {ok:true};
    }
    case "adminGetAvailability": {
      const [{data:av},{data:bl},{data:st}]=await Promise.all([
        s.from("consult_availability").select("id,weekday,start_time,end_time,active").order("weekday").order("start_time"),
        s.from("consult_blocked_dates").select("day,reason").gte("day",new Date().toISOString().slice(0,10)).order("day"),
        s.from("consult_settings").select("default_meeting_link").eq("id",1).maybeSingle()
      ]);
      return {intervals:av ?? [],blocked:bl ?? [],defaultLink:st?.default_meeting_link ?? ""};
    }
    case "adminSaveAvailability": {
      const d=input.data, norm=d.intervals.map(i=>({...i,start_time:i.start_time.slice(0,5),end_time:i.end_time.slice(0,5)}));
      for(const i of norm) if(i.end_time<=i.start_time) throw new HttpError(400,"Godzina zakończenia musi być późniejsza niż rozpoczęcia.");
      for(const a of norm) for(const b of norm) if(a!==b && a.weekday===b.weekday && a.start_time<b.end_time && b.start_time<a.end_time) throw new HttpError(400,"Przedziały w jednym dniu nie mogą na siebie nachodzić.");
      const del=await s.from("consult_availability").delete().not("id","is",null);
      if(del.error) throw new HttpError(500,"Nie udało się zapisać dostępności.");
      if(norm.length){const ins=await s.from("consult_availability").insert(norm);if(ins.error)throw new HttpError(500,"Nie udało się zapisać dostępności.");}
      const up=await s.from("consult_settings").update({default_meeting_link:d.defaultLink || null,updated_at:new Date().toISOString()}).eq("id",1);
      await logAdminEvent(s,{type:"availability_saved",actor:actor!.id,objectKind:"availability",result:up.error?"failed":"ok"});
      if(up.error)throw new HttpError(500,"Nie udało się zapisać linku.");
      return {ok:true};
    }
    case "adminBlockDate": {
      const d=input.data;
      const r=d.remove?await s.from("consult_blocked_dates").delete().eq("day",d.day):await s.from("consult_blocked_dates").upsert({day:d.day,reason:d.reason});
      await logAdminEvent(s,{type:d.remove?"date_unblocked":"date_blocked",actor:actor!.id,objectKind:"availability",result:r.error?"failed":"ok",detail:d.day});
      if(r.error)throw new HttpError(500,"Nie udało się zapisać blokady.");
      return {ok:true};
    }
  }
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers:CORS});
  if (req.method !== "POST") return json({message:"Niedozwolona metoda."},405);
  try { const s=db(), body=await req.json().catch(()=>null); return json(await handle(s,req,body)); }
  catch(e){const status=e instanceof HttpError?e.status:e instanceof z.ZodError?400:500;const message=e instanceof Error?e.message:"Wystąpił błąd serwera.";if(status>=500)console.error("tnb-consult:",message);return json({message},status);}
});
