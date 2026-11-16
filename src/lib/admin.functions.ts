import { assertAdmin, assertSuperadmin, logEvent } from "./admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };


export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: !!data, email: (context.claims as { email?: string }).email ?? null };
  });

// One auth.users read shared by dashboard counts and journal actor names.
async function usersIndex() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const all: Array<{ id: string; email?: string | undefined; created_at: string }> = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    all.push(...data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at })));
    if (data.users.length < 1000) break;
  }
  return all;
}
const EVENT_COLS = "id, created_at, type, actor, object_kind, object_id, result, detail";
type AdminEvent = { id: string; created_at: string; type: string; actor: string | null; actor_email: string | null; object_kind: string | null; object_id: string | null; result: string; detail: string | null };
const withEmails = (rows: any[], users: Array<{ id: string; email?: string | undefined }> | null): AdminEvent[] => {
  const m = new Map((users ?? []).map((u) => [u.id, u.email ?? null]));
  return rows.map((r) => ({ ...r, actor_email: r.actor ? m.get(r.actor) ?? null : null }));
};

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const now = new Date().toISOString();
    const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
    const c = async (q: any) => { const r = await q; return r.error ? null : (r.count ?? 0); };
    const h = { count: "exact", head: true } as const;
    const [users, library, posts, meetings, bookings, orders, pendingOrders, newMsgs, reports, failedMail, pendingRegs, deniedWeek, paid, events, active, pending, unsub] = await Promise.all([
      usersIndex(),
      c(db.from("library_items").select("id", h).eq("status", "published")),
      c(db.from("community_posts").select("id", h)),
      c(db.from("meetings").select("id", h).eq("status", "published").gte("starts_at", now)),
      c(db.from("consult_bookings").select("id", h).eq("status", "booked").gte("starts_at", now)),
      c(db.from("library_orders").select("id", h).eq("is_test", false)),
      c(db.from("library_orders").select("id", h).eq("status", "pending").eq("is_test", false)),
      c(db.from("contact_messages").select("id", h).eq("status", "new")),
      c(db.from("community_reports").select("id", h).eq("status", "open")),
      c(db.from("email_notification_log").select("id", h).eq("status", "failed")),
      c(db.from("meeting_registrations").select("id", h).eq("status", "pending")),
      c(db.from("admin_events").select("id", h).neq("result", "ok").gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString())),
      db.from("library_orders").select("amount, currency").in("status", ["paid", "delivered"]).eq("is_test", false).limit(10000),
      db.from("admin_events").select(EVENT_COLS).order("created_at", { ascending: false }).limit(8),
      c(db.from("newsletter_subscribers").select("id", h).eq("status", "active")),
      c(db.from("newsletter_subscribers").select("id", h).eq("status", "pending")),
      c(db.from("newsletter_subscribers").select("id", h).eq("status", "unsubscribed")),
    ]);
    const paidRows = (paid.error ? null : paid.data) as Array<{ amount: number; currency: string }> | null;
    const currencies = new Set((paidRows ?? []).map((r) => r.currency.toLowerCase()));
    return {
      usersTotal: users ? users.length : null,
      usersNew30: users ? users.filter((u) => u.created_at >= monthAgo).length : null,
      library, posts, meetings, bookings, orders, pendingOrders, newMsgs, reports, failedMail, pendingRegs, deniedWeek, active: active ?? 0, pending: pending ?? 0, unsub: unsub ?? 0,
      // Only sum when all paid orders share one currency, so the total is trustworthy.
      paidTotal: paidRows && currencies.size <= 1 ? paidRows.reduce((a, r) => a + r.amount, 0) : null,
      paidCurrency: [...currencies][0] ?? "pln",
      recent: withEmails(events.data ?? [], users),
    };
  });

const msgFilter = z.object({
  status: z.enum(["all", "new", "read", "archived", "inbox"]).default("inbox"),
  q: z.string().trim().max(200).default(""),
  sort: z.enum(["desc", "asc"]).default("desc"),
});

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => msgFilter.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("contact_messages").select("*").order("created_at", { ascending: data.sort === "asc" }).limit(500);
    if (data.status === "inbox") q = q.neq("status", "archived");
    else if (data.status !== "all") q = q.eq("status", data.status);
    if (data.q) {
      const s = data.q.replace(/[%,()]/g, " ");
      q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,subject.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać wiadomości.");
    return rows as Array<{ id: string; name: string; email: string; subject: string; message: string; status: string; created_at: string; read_at: string | null; archived_at: string | null }>;
  });

export const setMessageStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["new", "read", "archived"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const now = new Date().toISOString();
    const patch: { status: string; read_at?: string | null; archived_at?: string | null } =
      data.status === "new" ? { status: "new", read_at: null, archived_at: null }
      : data.status === "read" ? { status: "read", read_at: now, archived_at: null }
      : { status: "archived", archived_at: now };
    const { error, count } = await context.supabase.from("contact_messages").update(patch, { count: "exact" }).eq("id", data.id);
    if (error || !count) throw new Error("Nie udało się zmienić statusu wiadomości.");
    return { ok: true as const };
  });

const subFilter = z.object({
  status: z.enum(["all", "pending", "active", "unsubscribed"]).default("all"),
  q: z.string().trim().max(200).default(""),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
});

export const listSubscribers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => subFilter.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Tokens and IP hash are deliberately not selected.
    let q = context.supabase.from("newsletter_subscribers")
      .select("id,email,status,source,consent_text,consent_version,consent_given_at,opt_in_method,confirmed_at,unsubscribed_at,subscribe_count,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(5000);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.q) q = q.ilike("email", `%${data.q.replace(/[%,]/g, "")}%`);
    if (data.from) q = q.gte("created_at", `${data.from}T00:00:00Z`);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59.999Z`);
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać subskrybentów.");
    return rows as Array<{ id: string; email: string; status: string; source: string; consent_text: string; consent_version: string; consent_given_at: string; opt_in_method: string; confirmed_at: string | null; unsubscribed_at: string | null; subscribe_count: number; created_at: string; updated_at: string }>;
  });

export const getEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("email_settings").select("*").eq("id", 1).maybeSingle();
    if (error || !data) throw new Error("Nie udało się pobrać ustawień e-mail.");
    return data as { notification_recipient: string | null; sender_name: string; sender_local_part: string; sender_domain: string | null; admin_inbox_url: string | null; contact_notifications_enabled: boolean; newsletter_notifications_enabled: boolean; newsletter_double_opt_in: boolean; updated_at: string };
  });

const opt = (s: z.ZodString) => z.union([s, z.literal("")]).transform((v) => (v === "" ? null : v));
export const emailSettingsSchema = z.object({
  notification_recipient: opt(z.string().trim().email("Podaj poprawny adres e-mail").max(255)),
  sender_name: z.string().trim().min(1, "Podaj nazwę nadawcy").max(100),
  sender_local_part: z.string().trim().min(1, "Podaj część adresu przed @").max(64).regex(/^[a-z0-9._-]+$/i, "Dozwolone litery, cyfry, kropka, myślnik i podkreślnik"),
  sender_domain: opt(z.string().trim().toLowerCase().max(253).regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/, "Podaj poprawną domenę, np. powiadomienia.twojadomena.pl")),
  admin_inbox_url: opt(z.string().trim().url("Podaj pełny adres URL").max(500)),
  contact_notifications_enabled: z.boolean(),
  newsletter_notifications_enabled: z.boolean(),
  newsletter_double_opt_in: z.boolean(),
});

export const updateEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => emailSettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, "email_settings");
    const { error, count } = await context.supabase.from("email_settings")
      .update({ ...data, updated_at: new Date().toISOString() }, { count: "exact" }).eq("id", 1);
    if (error || !count) {
      await logEvent({ type: "settings_update", actor: context.userId, objectKind: "settings", objectId: "email", result: "failed" });
      throw new Error("Nie udało się zapisać ustawień.");
    }
    await logEvent({ type: "settings_update", actor: context.userId, objectKind: "settings", objectId: "email" });
    return { ok: true as const };
  });

const logFilter = z.object({
  kind: z.string().max(64).default("all"),
  status: z.enum(["all", "pending", "sending", "sent", "delivered", "failed", "cancelled", "skipped", "suppressed", "simulated"]).default("all"),
});

export const listNotificationLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => logFilter.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("email_notification_log").select("id, kind, related_id, recipient, status, reason, created_at, template_key, mode, attempts, provider_message_id, retryable, updated_at").order("created_at", { ascending: false }).limit(500);
    if (data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać historii powiadomień.");
    return rows as Array<{ id: string; kind: string; related_id: string | null; recipient: string | null; status: string; reason: string | null; created_at: string; template_key: string | null; mode: string; attempts: number; provider_message_id: string | null; retryable: boolean; updated_at: string }>;
  });

// ---- Moderacja społeczności ----
export const listCommunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: z.enum(["all", "published", "hidden"]).default("all") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("community_posts")
      .select("id, author_name, body, status, visibility, created_at, community_comments(id, author_name, body, created_at)")
      .order("created_at", { ascending: false }).limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać treści społeczności.");
    return rows as Array<{ id: string; author_name: string; body: string; status: string; visibility: string; created_at: string; community_comments: Array<{ id: string; author_name: string; body: string; created_at: string }> }>;
  });

export const moderateCommunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.discriminatedUnion("action", [
    z.object({ action: z.enum(["hide", "restore", "delete_post"]), id: z.string().uuid() }),
    z.object({ action: z.literal("set_visibility"), id: z.string().uuid(), visibility: z.enum(["public", "community"]) }),
    z.object({ action: z.literal("delete_comment"), id: z.string().uuid() }),
  ]).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const res = data.action === "delete_comment"
      ? await db.from("community_comments").delete().eq("id", data.id).select("id")
      : data.action === "delete_post"
        ? await db.from("community_posts").delete().eq("id", data.id).select("id")
        : data.action === "set_visibility"
        ? await db.from("community_posts").update({ visibility: data.visibility }).eq("id", data.id).select("id")
        : await db.from("community_posts").update({ status: data.action === "hide" ? "hidden" : "published" }).eq("id", data.id).select("id");
    await logEvent({ type: `community_${data.action}`, actor: context.userId, objectKind: data.action === "delete_comment" ? "comment" : "post", objectId: data.id, result: res.error || !res.data?.length ? "failed" : "ok" });
    if (res.error || !res.data?.length) throw new Error("Nie udało się wykonać operacji.");
    return { ok: true };
  });

export const listReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("community_reports")
      .select("id, reason, status, created_at, post_id, community_posts(author_name, body, status)")
      .eq("status", "open").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("Nie udało się pobrać zgłoszeń.");
    return data as unknown as Array<{ id: string; reason: string; status: string; created_at: string; post_id: string; community_posts: { author_name: string; body: string; status: string } | null }>;
  });

export const resolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const res = await context.supabase.from("community_reports").update({ status: "resolved" }).eq("id", data.id).select("id");
    await logEvent({ type: "report_resolved", actor: context.userId, objectKind: "report", objectId: data.id, result: res.error || !res.data?.length ? "failed" : "ok" });
    if (res.error || !res.data?.length) throw new Error("Nie udało się zamknąć zgłoszenia.");
    return { ok: true };
  });

const eventFilter = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  category: z.string().regex(/^[a-z]*$/).max(30).default(""),
  actor: z.string().uuid().or(z.literal("")).default(""),
  result: z.enum(["", "ok", "failed", "denied"]).default(""),
  typeIn: z.array(z.string().regex(/^[a-z_]+$/).max(60)).max(200).default([]),
  q: z.string().trim().max(100).default(""),
  page: z.number().int().min(0).max(10000).default(0),
});
const PAGE = 50;

export const listAdminEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => eventFilter.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("admin_events").select(EVENT_COLS, { count: "exact" }).order("created_at", { ascending: false });
    if (data.from) q = q.gte("created_at", `${data.from}T00:00:00+02:00`);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59.999+02:00`);
    if (data.category) q = q.like("type", `${data.category}\\_%`);
    if (data.actor) q = q.eq("actor", data.actor);
    if (data.result) q = q.eq("result", data.result);
    const s = data.q.replace(/[%,()*\\]/g, " ").trim();
    if (s || data.typeIn.length) {
      const ors = [s && `type.ilike.%${s}%`, s && `object_kind.ilike.%${s}%`, s && `detail.ilike.%${s}%`, data.typeIn.length && `type.in.(${data.typeIn.join(",")})`].filter(Boolean);
      q = q.or(ors.join(","));
    }
    const { data: rows, error, count } = await q.range(data.page * PAGE, data.page * PAGE + PAGE - 1);
    if (error) throw new Error("Nie udało się pobrać dziennika zdarzeń.");
    const users = await usersIndex();
    const actorIds = new Set((rows ?? []).map((r: any) => r.actor).filter(Boolean));
    return {
      rows: withEmails(rows ?? [], users), total: count ?? 0, pageSize: PAGE,
      actors: (users ?? []).filter((u) => actorIds.has(u.id) || u.id === data.actor).map((u) => ({ id: u.id, email: u.email ?? u.id })),
    };
  });
