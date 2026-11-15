import { createClient } from "@supabase/supabase-js";
import { corsHeaders as sdkCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "zod";

const CORS = new Headers({
  ...sdkCorsHeaders,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
  "X-Content-Type-Options": "nosniff",
});

function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed.default === "string") return parsed.default;
    } catch {
      return raw;
    }
  }
  return null;
}

function createSupabaseFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if ((apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + apiKey) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Backend panelu administratora nie jest skonfigurowany.");
  return createClient(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type Db = ReturnType<typeof adminClient>;
class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

async function logEvent(db: Db, event: {
  type: string; actor?: string | null; objectKind?: string | null; objectId?: string | null;
  result?: "ok" | "failed" | "denied"; detail?: string | null;
}) {
  try {
    await db.from("admin_events").insert({
      type: event.type,
      actor: event.actor ?? null,
      object_kind: event.objectKind ?? null,
      object_id: event.objectId ?? null,
      result: event.result ?? "ok",
      detail: event.detail?.slice(0, 300) ?? null,
    });
  } catch (error) {
    console.error("admin event log failed", error);
  }
}

async function requireAdmin(db: Db, req: Request, superadmin = false) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const { data: authData, error: authError } = await db.auth.getUser(match[1]);
  const user = authData.user;
  if (authError || !user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");

  const { data: isAdmin, error: adminError } = await db.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (adminError || !isAdmin) {
    await logEvent(db, { type: "access_denied", actor: user.id, result: "denied" });
    throw new HttpError(403, "Brak uprawnień administratora.");
  }
  if (superadmin) {
    const { data: isSuperadmin, error: superError } = await db.rpc("has_role", { _user_id: user.id, _role: "superadmin" });
    if (superError || !isSuperadmin) {
      await logEvent(db, { type: "access_denied", actor: user.id, objectKind: "settings", objectId: "email", result: "denied", detail: "Wymagana rola superadministratora" });
      throw new HttpError(403, "Tę zmianę może wykonać tylko superadministrator.");
    }
  }
  return user;
}

const msgFilter = z.object({
  status: z.enum(["all", "new", "read", "archived", "inbox"]).default("inbox"),
  q: z.string().trim().max(200).default(""),
  sort: z.enum(["desc", "asc"]).default("desc"),
});
const subFilter = z.object({
  status: z.enum(["all", "pending", "active", "unsubscribed"]).default("all"),
  q: z.string().trim().max(200).default(""),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
});
const opt = (schema: z.ZodString) => z.union([schema, z.literal("")]).transform((value) => value === "" ? null : value);
const emailSettingsSchema = z.object({
  notification_recipient: opt(z.string().trim().email().max(255)),
  sender_name: z.string().trim().min(1).max(100),
  sender_local_part: z.string().trim().min(1).max(64).regex(/^[a-z0-9._-]+$/i),
  sender_domain: opt(z.string().trim().toLowerCase().max(253).regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/)),
  admin_inbox_url: opt(z.string().trim().url().max(500)),
  contact_notifications_enabled: z.boolean(),
  newsletter_notifications_enabled: z.boolean(),
  newsletter_double_opt_in: z.boolean(),
});
const logFilter = z.object({
  kind: z.string().max(64).default("all"),
  status: z.enum(["all", "pending", "sending", "sent", "delivered", "failed", "cancelled", "skipped", "suppressed", "simulated"]).default("all"),
});
const communityFilter = z.object({ status: z.enum(["all", "published", "hidden"]).default("all") });
const moderationInput = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["hide", "restore", "delete_post"]), id: z.string().uuid() }),
  z.object({ action: z.literal("set_visibility"), id: z.string().uuid(), visibility: z.enum(["public", "community"]) }),
  z.object({ action: z.literal("delete_comment"), id: z.string().uuid() }),
]);
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

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("getDashboard") }),
  z.object({ action: z.literal("listMessages"), data: msgFilter }),
  z.object({ action: z.literal("setMessageStatus"), data: z.object({ id: z.string().uuid(), status: z.enum(["new", "read", "archived"]) }) }),
  z.object({ action: z.literal("listSubscribers"), data: subFilter }),
  z.object({ action: z.literal("getEmailSettings") }),
  z.object({ action: z.literal("updateEmailSettings"), data: emailSettingsSchema }),
  z.object({ action: z.literal("listNotificationLog"), data: logFilter }),
  z.object({ action: z.literal("listCommunity"), data: communityFilter }),
  z.object({ action: z.literal("moderateCommunity"), data: moderationInput }),
  z.object({ action: z.literal("listReports") }),
  z.object({ action: z.literal("resolveReport"), data: z.object({ id: z.string().uuid() }) }),
  z.object({ action: z.literal("listAdminEvents"), data: eventFilter }),
]);

async function usersIndex(db: Db) {
  const all: Array<{ id: string; email?: string; created_at: string }> = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    all.push(...data.users.map((user) => ({ id: user.id, email: user.email, created_at: user.created_at })));
    if (data.users.length < 1000) break;
  }
  return all;
}

const EVENT_COLS = "id, created_at, type, actor, object_kind, object_id, result, detail";
function withEmails(rows: any[], users: Array<{ id: string; email?: string }> | null) {
  const emails = new Map((users ?? []).map((user) => [user.id, user.email ?? null]));
  return rows.map((row) => ({ ...row, actor_email: row.actor ? emails.get(row.actor) ?? null : null }));
}

async function getDashboard(db: Db) {
  const now = new Date().toISOString();
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
  const count = async (query: any) => {
    const result = await query;
    return result.error ? null : (result.count ?? 0);
  };
  const head = { count: "exact", head: true } as const;
  const [
    users, library, posts, meetings, bookings, orders, pendingOrders, newMsgs, reports, failedMail,
    pendingRegs, deniedWeek, paid, events, active, pending, unsub,
  ] = await Promise.all([
    usersIndex(db),
    count(db.from("library_items").select("id", head).eq("status", "published")),
    count(db.from("community_posts").select("id", head)),
    count(db.from("meetings").select("id", head).eq("status", "published").gte("starts_at", now)),
    count(db.from("consult_bookings").select("id", head).eq("status", "booked").gte("starts_at", now)),
    count(db.from("library_orders").select("id", head).eq("is_test", false)),
    count(db.from("library_orders").select("id", head).eq("status", "pending").eq("is_test", false)),
    count(db.from("contact_messages").select("id", head).eq("status", "new")),
    count(db.from("community_reports").select("id", head).eq("status", "open")),
    count(db.from("email_notification_log").select("id", head).eq("status", "failed")),
    count(db.from("meeting_registrations").select("id", head).eq("status", "pending")),
    count(db.from("admin_events").select("id", head).neq("result", "ok").gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString())),
    db.from("library_orders").select("amount, currency").in("status", ["paid", "delivered"]).eq("is_test", false).limit(10000),
    db.from("admin_events").select(EVENT_COLS).order("created_at", { ascending: false }).limit(8),
    count(db.from("newsletter_subscribers").select("id", head).eq("status", "active")),
    count(db.from("newsletter_subscribers").select("id", head).eq("status", "pending")),
    count(db.from("newsletter_subscribers").select("id", head).eq("status", "unsubscribed")),
  ]);
  const paidRows = (paid.error ? null : paid.data) as Array<{ amount: number; currency: string }> | null;
  const currencies = new Set((paidRows ?? []).map((row) => row.currency.toLowerCase()));
  return {
    usersTotal: users ? users.length : null,
    usersNew30: users ? users.filter((user) => user.created_at >= monthAgo).length : null,
    library, posts, meetings, bookings, orders, pendingOrders, newMsgs, reports, failedMail, pendingRegs,
    deniedWeek, active: active ?? 0, pending: pending ?? 0, unsub: unsub ?? 0,
    paidTotal: paidRows && currencies.size <= 1 ? paidRows.reduce((sum, row) => sum + row.amount, 0) : null,
    paidCurrency: [...currencies][0] ?? "pln",
    recent: withEmails(events.data ?? [], users),
  };
}

async function listMessages(db: Db, input: z.infer<typeof msgFilter>) {
  let query = db.from("contact_messages").select("*")
    .order("created_at", { ascending: input.sort === "asc" }).limit(500);
  if (input.status === "inbox") query = query.neq("status", "archived");
  else if (input.status !== "all") query = query.eq("status", input.status);
  if (input.q) {
    const search = input.q.replace(/[%,()]/g, " ");
    query = query.or("name.ilike.%" + search + "%,email.ilike.%" + search + "%,subject.ilike.%" + search + "%");
  }
  const { data, error } = await query;
  if (error) throw new HttpError(500, "Nie udało się pobrać wiadomości.");
  return data;
}

async function setMessageStatus(db: Db, input: { id: string; status: "new" | "read" | "archived" }) {
  const now = new Date().toISOString();
  const patch = input.status === "new" ? { status: "new", read_at: null, archived_at: null }
    : input.status === "read" ? { status: "read", read_at: now, archived_at: null }
    : { status: "archived", archived_at: now };
  const { error, count } = await db.from("contact_messages").update(patch, { count: "exact" }).eq("id", input.id);
  if (error || !count) throw new HttpError(400, "Nie udało się zmienić statusu wiadomości.");
  return { ok: true as const };
}

async function listSubscribers(db: Db, input: z.infer<typeof subFilter>) {
  let query = db.from("newsletter_subscribers")
    .select("id,email,status,source,consent_text,consent_version,consent_given_at,opt_in_method,confirmed_at,unsubscribed_at,subscribe_count,created_at,updated_at")
    .order("created_at", { ascending: false }).limit(5000);
  if (input.status !== "all") query = query.eq("status", input.status);
  if (input.q) query = query.ilike("email", "%" + input.q.replace(/[%,]/g, "") + "%");
  if (input.from) query = query.gte("created_at", input.from + "T00:00:00Z");
  if (input.to) query = query.lte("created_at", input.to + "T23:59:59.999Z");
  const { data, error } = await query;
  if (error) throw new HttpError(500, "Nie udało się pobrać subskrybentów.");
  return data;
}

async function getEmailSettings(db: Db) {
  const { data, error } = await db.from("email_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) throw new HttpError(500, "Nie udało się pobrać ustawień e-mail.");
  return data;
}

async function updateEmailSettings(db: Db, input: z.infer<typeof emailSettingsSchema>, actor: string) {
  const { error, count } = await db.from("email_settings")
    .update({ ...input, updated_at: new Date().toISOString() }, { count: "exact" }).eq("id", 1);
  if (error || !count) {
    await logEvent(db, { type: "settings_update", actor, objectKind: "settings", objectId: "email", result: "failed" });
    throw new HttpError(400, "Nie udało się zapisać ustawień.");
  }
  await logEvent(db, { type: "settings_update", actor, objectKind: "settings", objectId: "email" });
  return { ok: true as const };
}

async function listNotificationLog(db: Db, input: z.infer<typeof logFilter>) {
  let query = db.from("email_notification_log")
    .select("id, kind, related_id, recipient, status, reason, created_at, template_key, mode, attempts, provider_message_id, retryable, updated_at")
    .order("created_at", { ascending: false }).limit(500);
  if (input.kind !== "all") query = query.eq("kind", input.kind);
  if (input.status !== "all") query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw new HttpError(500, "Nie udało się pobrać historii powiadomień.");
  return data;
}

async function listCommunity(db: Db, input: z.infer<typeof communityFilter>) {
  let query = db.from("community_posts")
    .select("id, author_name, body, status, visibility, created_at, community_comments(id, author_name, body, created_at)")
    .order("created_at", { ascending: false }).limit(200);
  if (input.status !== "all") query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw new HttpError(500, "Nie udało się pobrać treści społeczności.");
  return data;
}

async function moderateCommunity(db: Db, input: z.infer<typeof moderationInput>, actor: string) {
  let result: any;
  if (input.action === "delete_comment") result = await db.from("community_comments").delete().eq("id", input.id).select("id");
  else if (input.action === "delete_post") result = await db.from("community_posts").delete().eq("id", input.id).select("id");
  else if (input.action === "set_visibility") result = await db.from("community_posts").update({ visibility: input.visibility }).eq("id", input.id).select("id");
  else result = await db.from("community_posts").update({ status: input.action === "hide" ? "hidden" : "published" }).eq("id", input.id).select("id");
  await logEvent(db, {
    type: "community_" + input.action, actor, objectKind: input.action === "delete_comment" ? "comment" : "post",
    objectId: input.id, result: result.error || !result.data?.length ? "failed" : "ok",
  });
  if (result.error || !result.data?.length) throw new HttpError(400, "Nie udało się wykonać operacji.");
  return { ok: true };
}

async function listReports(db: Db) {
  const { data, error } = await db.from("community_reports")
    .select("id, reason, status, created_at, post_id, community_posts(author_name, body, status)")
    .eq("status", "open").order("created_at", { ascending: false }).limit(200);
  if (error) throw new HttpError(500, "Nie udało się pobrać zgłoszeń.");
  return data;
}

async function resolveReport(db: Db, input: { id: string }, actor: string) {
  const result = await db.from("community_reports").update({ status: "resolved" }).eq("id", input.id).select("id");
  await logEvent(db, { type: "report_resolved", actor, objectKind: "report", objectId: input.id, result: result.error || !result.data?.length ? "failed" : "ok" });
  if (result.error || !result.data?.length) throw new HttpError(400, "Nie udało się zamknąć zgłoszenia.");
  return { ok: true };
}

async function listAdminEvents(db: Db, input: z.infer<typeof eventFilter>) {
  let query = db.from("admin_events").select(EVENT_COLS, { count: "exact" }).order("created_at", { ascending: false });
  if (input.from) query = query.gte("created_at", input.from + "T00:00:00+02:00");
  if (input.to) query = query.lte("created_at", input.to + "T23:59:59.999+02:00");
  if (input.category) query = query.like("type", input.category + "\\_%");
  if (input.actor) query = query.eq("actor", input.actor);
  if (input.result) query = query.eq("result", input.result);
  const search = input.q.replace(/[%,()*\\]/g, " ").trim();
  if (search || input.typeIn.length) {
    const ors = [
      search && "type.ilike.%" + search + "%",
      search && "object_kind.ilike.%" + search + "%",
      search && "detail.ilike.%" + search + "%",
      input.typeIn.length && "type.in.(" + input.typeIn.join(",") + ")",
    ].filter(Boolean);
    query = query.or(ors.join(","));
  }
  const { data: rows, error, count } = await query.range(input.page * PAGE, input.page * PAGE + PAGE - 1);
  if (error) throw new HttpError(500, "Nie udało się pobrać dziennika zdarzeń.");
  const users = await usersIndex(db);
  const actorIds = new Set((rows ?? []).map((row: any) => row.actor).filter(Boolean));
  return {
    rows: withEmails(rows ?? [], users), total: count ?? 0, pageSize: PAGE,
    actors: (users ?? []).filter((user) => actorIds.has(user.id) || user.id === input.actor)
      .map((user) => ({ id: user.id, email: user.email ?? user.id })),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ message: "Niedozwolona metoda." }, 405);
  try {
    const db = adminClient();
    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return json({ message: "Nieprawidłowe żądanie." }, 400);
    const input = parsed.data;
    const needsSuperadmin = input.action === "updateEmailSettings";
    const user = await requireAdmin(db, req, needsSuperadmin);

    switch (input.action) {
      case "getDashboard": return json(await getDashboard(db));
      case "listMessages": return json(await listMessages(db, input.data));
      case "setMessageStatus": return json(await setMessageStatus(db, input.data));
      case "listSubscribers": return json(await listSubscribers(db, input.data));
      case "getEmailSettings": return json(await getEmailSettings(db));
      case "updateEmailSettings": return json(await updateEmailSettings(db, input.data, user.id));
      case "listNotificationLog": return json(await listNotificationLog(db, input.data));
      case "listCommunity": return json(await listCommunity(db, input.data));
      case "moderateCommunity": return json(await moderateCommunity(db, input.data, user.id));
      case "listReports": return json(await listReports(db));
      case "resolveReport": return json(await resolveReport(db, input.data, user.id));
      case "listAdminEvents": return json(await listAdminEvents(db, input.data));
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Wystąpił błąd serwera.";
    if (status >= 500) console.error("tnb-admin error:", message);
    return json({ message }, status);
  }
  return json({ message: "Nieznana operacja." }, 400);
});
