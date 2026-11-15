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
  z.object({ action: z.literal("controlCenterSearch"), data: z.object({ q: z.string().trim().min(2, "Wpisz co najmniej 2 znaki.").max(100) }) }),
  z.object({ action: z.literal("controlCenterHistory"), data: z.object({
    kind: z.enum(["order", "user", "library_request", "actor"]),
    id: z.string().uuid(),
    offsets: z.object({
      order: z.number().int().min(0).max(1000000),
      admin: z.number().int().min(0).max(1000000),
      mail: z.number().int().min(0).max(1000000).default(0),
    }).default({ order: 0, admin: 0, mail: 0 }),
    before: z.string().datetime().optional(),
  }) }),
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

const CC_SEARCH_LIMIT = 100;
const CC_HISTORY_SIZE = 30;
const CC_ORDER_COLS = "id, order_number, created_at, paid_at, delivered_at, status, delivery_status, buyer_email, buyer_name, amount, currency, payment_method, provider, environment, is_test, user_id, access_expires_at, access_revoked_at, item_id, library_items(title, slug)";
const CC_REQUEST_COLS = "id, item_id, item_title, mode, status, user_id, first_name, last_name, email, downloaded_at, download_count, notification_status, created_at";
type CCOrderRow = {
  id: string; order_number: string; created_at: string; paid_at: string | null; delivered_at: string | null;
  status: string; delivery_status: string; buyer_email: string; buyer_name: string | null; amount: number;
  currency: string; payment_method: string; provider: string | null; environment: string; is_test: boolean;
  user_id: string | null; access_expires_at: string | null; access_revoked_at: string | null; item_id: string;
  library_items: { title: string; slug: string } | null;
};
type CCRequestRow = {
  id: string; item_id: string; item_title: string; mode: string; status: string; user_id: string | null;
  first_name: string | null; last_name: string | null; email: string | null; downloaded_at: string | null;
  download_count: number; notification_status: string | null; created_at: string;
};
type CCAuthUser = {
  id: string; email?: string; created_at: string; email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
};
type CCHistoryEvent = {
  id: string; at: string; source: "order" | "admin" | "mail"; type: string; actor: string | null;
  objectKind: string; objectId: string; detail: string | null; result: string | null;
};

async function ccRead<T>(query: PromiseLike<{ data: T | null; error: unknown }>): Promise<{ data: T | null; error: unknown }> {
  try { return await query; } catch { return { data: null, error: true }; }
}
function ccReadState(error: unknown, count: number, limit: number, incomplete = false) {
  return { error: error ? "Nie udało się pobrać danych. Spróbuj ponownie." : null, limited: !error && count > limit, incomplete };
}
const ccFilterValue = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
function ccSearchParts(query: string) {
function ccHasAccess(order: { status: string; paid_at: string | null; access_revoked_at: string | null }) {
  return !!order.paid_at && !order.access_revoked_at && ["paid", "refund_pending", "refunded"].includes(order.status);
}
function ccAccessPresentation(allowed: boolean, expiresAt: string | null, now = Date.now()) {
  const expired = !!expiresAt && new Date(expiresAt).getTime() <= now;
  return {
    allowed, expired,
    label: allowed && expired ? "Reguła dostępu spełniona — data ważności minęła, wymaga weryfikacji" : allowed ? "aktywny" : "brak",
  };
}
function ccAccountMatches(userId: string | null, email: string | null, users: Array<{ id: string; email: string | null }>) {
  return users.flatMap((user) => userId === user.id ? [{ userId: user.id, kind: "user_id" as const }]
    : email && user.email && email.toLowerCase() === user.email.toLowerCase() ? [{ userId: user.id, kind: "email" as const }] : []);
}
function ccHistoryPage(order: CCHistoryEvent[], admin: CCHistoryEvent[], offsets: { order: number; admin: number; mail?: number }, mail: CCHistoryEvent[] = []) {
  const all = [...new Map([...order, ...admin, ...mail].map((event) => [event.source + "-" + event.id, event])).values()];
  const rows = all.sort((a, b) => b.at.localeCompare(a.at) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id)).slice(0, CC_HISTORY_SIZE);
  return {
    rows,
    next: {
      order: offsets.order + rows.filter((row) => row.source === "order").length,
      admin: offsets.admin + rows.filter((row) => row.source === "admin").length,
      mail: (offsets.mail ?? 0) + rows.filter((row) => row.source === "mail").length,
    },
    hasMore: all.length > rows.length,
  };
}

async function controlCenterSearch(db: Db, query: string) {
  const { safe, words } = ccSearchParts(query);
  if (safe.length < 2) throw new HttpError(400, "Wpisz co najmniej 2 znaki wyszukiwania.");
  const pattern = ccFilterValue("%" + safe + "%");
  const [identSearch, authResult, materials] = await Promise.all([
    ccRead(db.from("user_identities").select("user_id, tnb_id").ilike("tnb_id", "%" + safe + "%").limit(CC_SEARCH_LIMIT + 1)),
    ccRead<{ users: CCAuthUser[] }>(db.auth.admin.listUsers({ page: 1, perPage: 1000 })),
    ccRead(db.from("library_items").select("id, slug, title")
      .or("slug.eq." + ccFilterValue(safe) + ",title.ilike." + ccFilterValue("%" + safe + "%"))
      .order("id", { ascending: true }).limit(CC_SEARCH_LIMIT + 1)),
  ]);
  const authUsers: CCAuthUser[] = authResult.error ? [] : authResult.data?.users ?? [];
  const matched = new Set<string>(identSearch.error ? [] : (identSearch.data ?? []).slice(0, CC_SEARCH_LIMIT).map((row: any) => row.user_id));
  const userName = (user: CCAuthUser) => {
    const meta = user.user_metadata ?? {};
    const val = (key: string) => typeof meta[key] === "string" ? (meta[key] as string).trim() : "";
    return [val("first_name"), val("last_name")].filter(Boolean).join(" ") || val("full_name") || val("name");
  };
  for (const user of authUsers) {
    if ((user.email ?? "").toLowerCase().includes(safe.toLowerCase()) || userName(user).toLowerCase().includes(safe.toLowerCase())) matched.add(user.id);
  }
  const itemIds = materials.error ? [] : (materials.data ?? []).slice(0, CC_SEARCH_LIMIT).map((item: any) => item.id);
  const itemFilter = itemIds.length ? ",item_id.in.(" + itemIds.join(",") + ")" : "";
  const fullName = words.length > 1
    ? "and(first_name.ilike." + ccFilterValue("%" + words.slice(0, -1).join(" ") + "%") + ",last_name.ilike." + ccFilterValue("%" + words.at(-1) + "%") + ")"
    : null;
  const [orderSearch, requestSearch] = await Promise.all([
    ccRead(db.from("library_orders").select(CC_ORDER_COLS)
      .or("order_number.ilike." + pattern + ",buyer_email.ilike." + pattern + ",buyer_name.ilike." + pattern + itemFilter)
      .order("created_at", { ascending: false }).limit(CC_SEARCH_LIMIT + 1)),
    ccRead(db.from("library_requests").select(CC_REQUEST_COLS)
      .or("email.ilike." + pattern + ",first_name.ilike." + pattern + ",last_name.ilike." + pattern + (fullName ? "," + fullName : "") + itemFilter)
      .order("created_at", { ascending: false }).limit(CC_SEARCH_LIMIT + 1)),
  ]);
  const orders = (orderSearch.error ? [] : orderSearch.data ?? []) as unknown as CCOrderRow[];
  const requests = (requestSearch.error ? [] : requestSearch.data ?? []) as unknown as CCRequestRow[];
  for (const order of orders.slice(0, CC_SEARCH_LIMIT)) if (order.user_id) matched.add(order.user_id);
  for (const request of requests.slice(0, CC_SEARCH_LIMIT)) if (request.user_id) matched.add(request.user_id);
  const emailsFound = new Set([
    ...orders.slice(0, CC_SEARCH_LIMIT).map((order) => order.buyer_email.toLowerCase()),
    ...requests.slice(0, CC_SEARCH_LIMIT).flatMap((request) => request.email ? [request.email.toLowerCase()] : []),
  ]);
  for (const user of authUsers) if (user.email && emailsFound.has(user.email.toLowerCase())) matched.add(user.id);
  const ids = [...matched].slice(0, CC_SEARCH_LIMIT);
  const emails = authUsers.filter((user) => ids.includes(user.id)).flatMap((user) => user.email ? [user.email.toLowerCase()] : []);
  const orderLinks = [...ids.map((id) => "user_id.eq." + id), ...emails.map((email) => "buyer_email.eq." + ccFilterValue(email))];
  const requestLinks = [...ids.map((id) => "user_id.eq." + id), ...emails.map((email) => "email.eq." + ccFilterValue(email))];
  const empty = { data: [], error: null };
  const [roles, identities, linkedOrders, linkedRequests] = await Promise.all([
    ids.length ? ccRead(db.from("user_roles").select("user_id, role").in("user_id", ids)) : empty,
    ids.length ? ccRead(db.from("user_identities").select("user_id, tnb_id").in("user_id", ids)) : empty,
    orderLinks.length ? ccRead((itemIds.length ? db.from("library_orders").select(CC_ORDER_COLS).in("item_id", itemIds) : db.from("library_orders").select(CC_ORDER_COLS))
      .or(orderLinks.join(",")).order("created_at", { ascending: false }).limit(CC_SEARCH_LIMIT + 1)) : empty,
    requestLinks.length ? ccRead((itemIds.length ? db.from("library_requests").select(CC_REQUEST_COLS).in("item_id", itemIds) : db.from("library_requests").select(CC_REQUEST_COLS))
      .or(requestLinks.join(",")).order("created_at", { ascending: false }).limit(CC_SEARCH_LIMIT + 1)) : empty,
  ]);
  const users = ids.map((id) => {
    const user = authUsers.find((candidate) => candidate.id === id);
    return {
      id, email: user?.email ?? null, name: user ? userName(user) || null : null,
      tnbId: identities.error ? null : identities.data?.find((row: any) => row.user_id === id)?.tnb_id ?? null,
      roles: roles.error ? null : (roles.data ?? []).filter((row: any) => row.user_id === id).map((row: any) => row.role),
      confirmed: user ? !!user.email_confirmed_at : null, createdAt: user?.created_at ?? null,
    };
  });
  const allOrders = [...new Map([
    ...orders.slice(0, CC_SEARCH_LIMIT),
    ...(linkedOrders.error ? [] : linkedOrders.data ?? []) as unknown as CCOrderRow[],
  ].map((order) => [order.id, order])).values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const allRequests = [...new Map([
    ...requests.slice(0, CC_SEARCH_LIMIT),
    ...(linkedRequests.error ? [] : linkedRequests.data ?? []) as unknown as CCRequestRow[],
  ].map((request) => [request.id, request])).values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const sourceIncomplete = !!(identSearch.error || authResult.error || materials.error)
    || authUsers.length >= 1000 || matched.size > CC_SEARCH_LIMIT || (materials.data?.length ?? 0) > CC_SEARCH_LIMIT;
  return {
    states: {
      users: ccReadState(authResult.error || identSearch.error || roles.error || identities.error, Math.max(matched.size, identSearch.data?.length ?? 0), CC_SEARCH_LIMIT, authUsers.length >= 1000),
      materials: ccReadState(materials.error, materials.data?.length ?? 0, CC_SEARCH_LIMIT),
      orders: ccReadState(orderSearch.error || linkedOrders.error, Math.max(orders.length, linkedOrders.data?.length ?? 0, allOrders.length), CC_SEARCH_LIMIT, sourceIncomplete),
      requests: ccReadState(requestSearch.error || linkedRequests.error, Math.max(requests.length, linkedRequests.data?.length ?? 0, allRequests.length), CC_SEARCH_LIMIT, sourceIncomplete),
    },
    users,
    materials: materials.error ? [] : (materials.data ?? []).slice(0, CC_SEARCH_LIMIT),
    orders: allOrders.slice(0, CC_SEARCH_LIMIT).map((order) => {
      const access = ccAccessPresentation(ccHasAccess(order), order.access_expires_at);
      const warnings: string[] = [];
      if (["paid", "refund_pending", "refunded"].includes(order.status) && !order.paid_at) warnings.push("Status płatności bez daty opłacenia.");
      if (order.paid_at && ["pending", "failed", "cancelled"].includes(order.status)) warnings.push("Data opłacenia przy statusie bez płatności.");
      if (order.status === "paid" && order.access_revoked_at) warnings.push("Dostęp cofnięty przy statusie „Opłacone”.");
      if (order.delivered_at && !access.allowed) warnings.push("Oznaczono jako dostarczone bez spełnienia reguły dostępu.");
      return {
        id: order.id, orderNumber: order.order_number, itemId: order.item_id, itemTitle: order.library_items?.title ?? "",
        itemSlug: order.library_items?.slug ?? null, createdAt: order.created_at, status: order.status, amount: order.amount,
        currency: order.currency, isTest: order.is_test, paidAt: order.paid_at, buyerEmail: order.buyer_email,
        userId: order.user_id, access, accessExpiresAt: order.access_expires_at, accessRevokedAt: order.access_revoked_at,
        matches: ccAccountMatches(order.user_id, order.buyer_email, users), warnings,
      };
    }),
    requests: allRequests.slice(0, CC_SEARCH_LIMIT).map((request) => ({
      id: request.id, itemId: request.item_id, itemTitle: request.item_title, mode: request.mode, status: request.status,
      userId: request.user_id, name: [request.first_name, request.last_name].filter(Boolean).join(" ") || null,
      email: request.email, createdAt: request.created_at, downloadedAt: request.downloaded_at,
      downloadCount: request.download_count, notificationStatus: request.notification_status,
      matches: ccAccountMatches(request.user_id, request.email, users),
      warnings: request.download_count > 0 && !request.downloaded_at ? ["Pobrania bez daty pobrania."] : [],
    })),
  };
}

type CCHistoryInput = {
  kind: "order" | "user" | "library_request" | "actor";
  id: string;
  offsets: { order: number; admin: number; mail: number };
  before?: string;
};
async function controlCenterHistory(db: Db, input: CCHistoryInput) {
  const before = input.before ?? new Date().toISOString();
  const empty = { data: [], error: null };
  let adminQuery = db.from("admin_events")
    .select("id, created_at, type, actor, object_kind, object_id, result, detail")
    .lte("created_at", before);
  adminQuery = input.kind === "actor"
    ? adminQuery.eq("actor", input.id)
    : adminQuery.eq("object_kind", input.kind).eq("object_id", input.id);
  const [orderRes, adminRes, mailRes] = await Promise.all([
    input.kind === "order" ? ccRead(db.from("library_order_events").select("id, order_id, type, detail, created_at")
      .eq("order_id", input.id).lte("created_at", before).order("created_at", { ascending: false })
      .order("id", { ascending: true }).range(input.offsets.order, input.offsets.order + CC_HISTORY_SIZE)) : empty,
    ccRead(adminQuery.order("created_at", { ascending: false }).order("id", { ascending: true })
      .range(input.offsets.admin, input.offsets.admin + CC_HISTORY_SIZE)),
    input.kind === "order" ? ccRead(db.from("email_notification_log")
      .select("id, related_id, kind, template_key, status, reason, mode, created_at")
      .eq("related_id", input.id).lte("created_at", before).order("created_at", { ascending: false })
      .order("id", { ascending: true }).range(input.offsets.mail, input.offsets.mail + CC_HISTORY_SIZE)) : empty,
  ]);
  if (orderRes.error || adminRes.error || mailRes.error) {
    return { ...ccHistoryPage([], [], input.offsets), error: "Nie udało się pobrać historii. Spróbuj ponownie.", before };
  }
  const orderRows: CCHistoryEvent[] = (orderRes.data ?? []).map((event: any) => ({
    id: event.id, at: event.created_at, source: "order", type: event.type, actor: null,
    objectKind: "order", objectId: event.order_id, detail: event.detail, result: null,
  }));
  const adminRows: CCHistoryEvent[] = (adminRes.data ?? []).map((event: any) => ({
    id: event.id, at: event.created_at, source: "admin", type: event.type, actor: event.actor,
    objectKind: event.object_kind ?? "—", objectId: event.object_id ?? "—", detail: event.detail, result: event.result,
  }));
  const mailRows: CCHistoryEvent[] = (mailRes.data ?? []).map((event: any) => ({
    id: event.id, at: event.created_at, source: "mail", type: event.template_key ?? event.kind,
    actor: null, objectKind: "order", objectId: event.related_id ?? input.id,
    detail: "Tryb: " + event.mode + (event.reason ? " · " + event.reason : ""),
    result: event.status === "simulated" ? "symulacja (nie wysłano)" : event.status === "sent" ? "wysłano" : event.status,
  }));
  return { ...ccHistoryPage(orderRows, adminRows, input.offsets, mailRows), error: null, before };
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
      case "controlCenterSearch": return json(await controlCenterSearch(db, input.data.q));
      case "controlCenterHistory": return json(await controlCenterHistory(db, input.data));
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Wystąpił błąd serwera.";
    if (status >= 500) console.error("tnb-admin error:", message);
    return json({ message }, status);
  }
  return json({ message: "Nieznana operacja." }, 400);
});
