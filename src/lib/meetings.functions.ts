import { assertAdmin, logEvent } from "./admin-auth.server";
const LOG = (ctx: { userId: string }, type: string, kind: string, id?: string, result: "ok" | "failed" = "ok", detail?: string) => logEvent({ type, actor: ctx.userId, objectKind: kind, objectId: id, result, detail });

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MeetingDetail, PublicMeeting } from "./meetings";

// Public reads go through the service role with an explicit safe column list:
// online_link, unpublished locations and participants' data never leave the server.
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
type Ctx = { supabase: any; userId: string };
async function optionalUser() {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.split(".").length !== 3) return null;
  const { data } = await (await admin()).auth.getUser(token);
  return data.user ?? null;
}

const COLS = "id, slug, title, kind, summary, description, rules, starts_at, ends_at, location, location_public, image_url, capacity, registration_open, requires_login, requires_approval";
async function taken(ids: string[]) {
  const map = new Map<string, number>();
  if (!ids.length) return map;
  const { data } = await (await admin()).from("meeting_registrations").select("meeting_id").in("meeting_id", ids).in("status", ["pending", "approved"]);
  for (const r of data ?? []) map.set(r.meeting_id, (map.get(r.meeting_id) ?? 0) + 1);
  return map;
}
function toPublic(m: any, t: number): MeetingDetail {
  return {
    id: m.id, slug: m.slug, title: m.title, kind: m.kind, summary: m.summary, description: m.description, rules: m.rules,
    starts_at: m.starts_at, ends_at: m.ends_at, location: m.location_public && m.location ? m.location : null, has_image: !!m.image_url,
    capacity: m.capacity, taken: t, registration_open: m.registration_open, requires_login: m.requires_login, requires_approval: m.requires_approval,
  };
}

export const listMeetings = createServerFn({ method: "GET" }).handler(async (): Promise<PublicMeeting[]> => {
  const { data } = await (await admin()).from("meetings").select(COLS).eq("status", "published").order("starts_at", { ascending: true }).limit(200);
  const t = await taken((data ?? []).map((m) => m.id));
  return (data ?? []).map((m) => { const { description: _d, rules: _r, ...rest } = toPublic(m, t.get(m.id) ?? 0); return rest; });
});

export const getMeeting = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { data: m } = await (await admin()).from("meetings").select(COLS).eq("slug", data.slug).eq("status", "published").maybeSingle();
    if (!m) return null;
    return toPublic(m, (await taken([m.id])).get(m.id) ?? 0);
  });

// Logged-in user's own registration for a meeting (+ online link only when approved).
export const getMyRegistration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ meetingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r } = await context.supabase.from("meeting_registrations").select("status, access_token").eq("meeting_id", data.meetingId).eq("user_id", context.userId).maybeSingle();
    if (!r) return null;
    let link: string | null = null;
    if (r.status === "approved") {
      const { data: m } = await (await admin()).from("meetings").select("online_link, kind, status").eq("id", data.meetingId).maybeSingle();
      if (m?.status === "published" && m.kind === "online") link = m.online_link ?? null;
    }
    return { status: r.status as string, token: r.access_token as string, link };
  });

const CONSENT = "Wyrażam zgodę na przetwarzanie moich danych (imię i nazwisko, e-mail, opcjonalnie telefon i wiadomość) w celu obsługi zgłoszenia na spotkanie TNB. Akceptuję Regulamin i Politykę prywatności.";

export const registerForMeeting = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    meetingId: z.string().uuid(),
    name: z.string().trim().min(3, "Podaj imię i nazwisko.").max(120),
    email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
    phone: z.string().trim().max(20).regex(/^$|^\+?[0-9 ()-]{7,20}$/, "Podaj poprawny numer telefonu.").default(""),
    message: z.string().trim().max(1000, "Wiadomość może mieć maksymalnie 1000 znaków.").default(""),
    consent: z.literal(true, { errorMap: () => ({ message: "Zaakceptuj wymagane zgody." }) }),
    website: z.string().max(200).default(""), // honeypot
    elapsedMs: z.number().int().min(0).default(0),
  }).parse(d))
  .handler(async ({ data }): Promise<{ token: string; status: string } | { error: string }> => {
    if (data.website || data.elapsedMs < 2500) return { error: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę." };
    const s = await admin();
    const { data: m } = await s.from("meetings").select("id, status, starts_at, ends_at, registration_open, requires_login, requires_approval").eq("id", data.meetingId).maybeSingle();
    if (!m || m.status !== "published") return { error: "To spotkanie nie jest dostępne." };
    if (new Date(m.ends_at ?? m.starts_at).getTime() < Date.now()) return { error: "To spotkanie już się odbyło." };
    if (!m.registration_open) return { error: "Zapisy na to spotkanie są zamknięte." };
    const user = await optionalUser();
    if (m.requires_login && !user) return { error: "Zapisy na to spotkanie wymagają zalogowania." };
    if (user) {
      const { count } = await s.from("meeting_registrations").select("id", { count: "exact", head: true }).eq("meeting_id", m.id).eq("user_id", user.id);
      if (count) return { error: "Z tego konta wysłano już zgłoszenie na to spotkanie." };
    }
    const { count: recent } = await s.from("meeting_registrations").select("id", { count: "exact", head: true })
      .ilike("email", data.email).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((recent ?? 0) >= 5) return { error: "Wysłano zbyt wiele zgłoszeń z tego adresu. Spróbuj później." };
    const status = m.requires_approval ? "pending" : "approved";
    const { data: r, error } = await s.from("meeting_registrations").insert({
      meeting_id: m.id, user_id: user?.id ?? null, name: data.name, email: data.email, phone: data.phone || null,
      message: data.message || null, consent_text: CONSENT, status, decided_at: status === "approved" ? new Date().toISOString() : null,
    }).select("id, access_token").single();
    if (error) {
      if (error.code === "23505") return { error: "Na ten adres e-mail wysłano już zgłoszenie na to spotkanie." };
      if (/meeting_full/.test(error.message)) return { error: "Brak wolnych miejsc na to spotkanie." };
      return { error: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie." };
    }
    const { notifyRegistration } = await import("./meetings-notify.server");
    await notifyRegistration(status === "approved" ? "meeting_approved" : "meeting_registration",
      { id: r.id, name: data.name, email: data.email, access_token: r.access_token }, m.starts_at);
    return { token: r.access_token, status };
  });

export const getRegistrationByToken = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: r } = await s.from("meeting_registrations").select("status, name, meeting_id").eq("access_token", data.token).maybeSingle();
    if (!r) return null;
    const { data: m } = await s.from("meetings").select("title, slug, kind, starts_at, status, online_link, location, location_public").eq("id", r.meeting_id).maybeSingle();
    if (!m) return null;
    const approved = r.status === "approved" && m.status === "published";
    return {
      status: r.status as string, name: r.name, title: m.title, slug: m.status === "published" ? m.slug : null, kind: m.kind, starts_at: m.starts_at,
      link: approved && m.kind === "online" ? m.online_link : null,
      location: m.location_public && m.location ? m.location : null,
    };
  });

// ---------------- Admin ----------------
const meetingInput = z.object({
  id: z.string().uuid().nullable(),
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/, "Adres może zawierać małe litery, cyfry i myślniki."),
  title: z.string().trim().min(3, "Tytuł musi mieć co najmniej 3 znaki.").max(200),
  kind: z.enum(["online", "live"]),
  summary: z.string().trim().max(600), description: z.string().max(20000), rules: z.string().max(5000),
  starts_at: z.string().datetime({ message: "Podaj datę i godzinę." }), ends_at: z.string().datetime().nullable(),
  location: z.string().trim().max(300), location_public: z.boolean(),
  capacity: z.number().int().positive().max(100000).nullable(),
  registration_open: z.boolean(), requires_login: z.boolean(), requires_approval: z.boolean(),
  online_link: z.string().trim().max(500).refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Link musi zaczynać się od https://"),
});

export const adminListMeetings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("meetings").select("id, slug, title, kind, status, starts_at, capacity, registration_open").order("starts_at", { ascending: false });
    if (error) throw new Error("Nie udało się wczytać spotkań.");
    const { data: regs } = await context.supabase.from("meeting_registrations").select("meeting_id, status");
    return (data ?? []).map((m: any) => {
      const rs = (regs ?? []).filter((r: any) => r.meeting_id === m.id);
      const c = (s: string) => rs.filter((r: any) => r.status === s).length;
      return { ...m, total: rs.length, pending: c("pending"), approved: c("approved"), rejected: c("rejected") };
    });
  });

export const adminGetMeeting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: m, error } = await context.supabase.from("meetings").select("*").eq("id", data.id).maybeSingle();
    if (error || !m) throw new Error("Nie znaleziono spotkania.");
    return m;
  });

export const adminSaveMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => meetingInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.ends_at && new Date(data.ends_at) <= new Date(data.starts_at)) throw new Error("Zakończenie musi być późniejsze niż rozpoczęcie.");
    const { id, online_link, ...rest } = data;
    const prev = id ? (await context.supabase.from("meetings").select("starts_at").eq("id", id).maybeSingle()).data : null;
    const row = { ...rest, online_link: online_link || null };
    const q = id ? context.supabase.from("meetings").update(row).eq("id", id).select("id").single()
      : context.supabase.from("meetings").insert(row).select("id").single();
    const { data: saved, error } = await q;
    await LOG(context, id ? "meeting_edit" : "meeting_create", "meeting", saved?.id ?? id ?? undefined, error ? "failed" : "ok", rest.title);
    if (error) throw new Error(error.code === "23505" ? "Spotkanie o takim adresie już istnieje." : "Nie udało się zapisać spotkania.");
    if (prev && new Date(prev.starts_at).getTime() !== new Date(rest.starts_at).getTime()) {
      // Date changed: tell everyone with an active registration (once per registration and new date).
      const { data: regs } = await (await admin()).from("meeting_registrations").select("id, name, email, access_token").eq("meeting_id", id!).in("status", ["pending", "approved"]);
      const { notifyRegistration } = await import("./meetings-notify.server");
      for (const r of regs ?? []) await notifyRegistration("meeting_rescheduled", r, rest.starts_at, `-${new Date(rest.starts_at).getTime()}`);
    }
    return { id: saved.id as string };
  });

export const adminSetMeetingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: { status: string; published_at?: string } = { status: data.status };
    if (data.status === "published") patch.published_at = new Date().toISOString();
    const { error } = await context.supabase.from("meetings").update(patch).eq("id", data.id);
    await LOG(context, `meeting_${data.status}`, "meeting", data.id, error ? "failed" : "ok");
    if (error) throw new Error("Nie udało się zmienić statusu.");
    return { ok: true };
  });

export const adminUploadMeetingImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), name: z.string().max(200), type: z.string().max(100), base64: z.string().max(7_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!["image/jpeg", "image/png", "image/webp"].includes(data.type)) throw new Error("Grafika musi być plikiem JPG, PNG lub WEBP.");
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 5 * 1024 * 1024) throw new Error("Grafika może mieć maksymalnie 5 MB.");
    const ext = (data.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
    const path = `${data.id}/${Date.now()}.${ext}`;
    const up = await (await admin()).storage.from("meeting-images").upload(path, bytes, { contentType: data.type });
    if (up.error) throw new Error("Nie udało się przesłać grafiki.");
    const { error } = await context.supabase.from("meetings").update({ image_url: path }).eq("id", data.id);
    if (error) throw new Error("Nie udało się przypisać grafiki.");
    return { ok: true };
  });

export const adminRemoveMeetingImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("meetings").update({ image_url: null }).eq("id", data.id);
    if (error) throw new Error("Nie udało się usunąć grafiki.");
    return { ok: true };
  });

export const adminListRegistrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ meetingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase.from("meeting_registrations")
      .select("id, name, email, phone, message, status, attended, user_id, created_at, decided_at").eq("meeting_id", data.meetingId).order("created_at");
    if (error) throw new Error("Nie udało się wczytać zgłoszeń.");
    return rows ?? [];
  });

export const adminUpdateRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(), attended: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: { status?: string; decided_at?: string; decided_by?: string; attended?: boolean } = {};
    if (data.status) Object.assign(patch, { status: data.status, decided_at: new Date().toISOString(), decided_by: context.userId });
    if (data.attended !== undefined) patch.attended = data.attended;
    const { data: before } = await context.supabase.from("meeting_registrations").select("status").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("meeting_registrations").update(patch).eq("id", data.id);
    await LOG(context, data.status ? `registration_${data.status}` : "registration_attendance", "registration", data.id, error ? "failed" : "ok");
    if (error) throw new Error(/meeting_full/.test(error.message) ? "Brak wolnych miejsc — limit uczestników został osiągnięty." : "Nie udało się zaktualizować zgłoszenia.");
    // E-mail only after the decision is really saved and only on an actual status change.
    if ((data.status === "approved" || data.status === "rejected") && before?.status !== data.status) {
      const s = await admin();
      const { data: r } = await s.from("meeting_registrations").select("id, name, email, access_token, meeting_id").eq("id", data.id).maybeSingle();
      const { data: m } = r ? await s.from("meetings").select("starts_at").eq("id", r.meeting_id).maybeSingle() : { data: null };
      if (r && m) await (await import("./meetings-notify.server")).notifyRegistration(data.status === "approved" ? "meeting_approved" : "meeting_rejected", r, m.starts_at);
    }
    return { ok: true };
  });
