import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "zod";
import { EVENT_MAP, DEFAULT_TEMPLATES } from "./registry.ts";
import { render, maskSensitive, stripSensitive, type Vars } from "./render.ts";

const CORS = new Headers({ ...corsHeaders, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version", "Access-Control-Max-Age": "86400", "X-Content-Type-Options": "nosniff" });
const CALLBACK_PATH = "/api/public/instagram/callback";
const GRAPH = "https://graph.instagram.com";
const STALE_MS = 30 * 60 * 1000;
const EMAIL = /^[^\s@<>"]+@[^\s@<>]+\.[a-z]{2,}$/i;
const SUBMISSION_STATUSES = ["new", "review", "contacted", "invited", "recorded", "rejected", "archived"] as const;
const storySchema = z.object({
  name: z.string().trim().min(1, "Podaj imię i nazwisko").max(120, "Maksymalnie 120 znaków"),
  email: z.string().trim().email("Podaj poprawny adres e-mail").max(255),
  phone: z.string().trim().max(40, "Maksymalnie 40 znaków").regex(/^[0-9+()\s-]*$/, "Numer może zawierać tylko cyfry, spacje i znaki + ( ) -"),
  about: z.string().trim().max(1000, "Maksymalnie 1000 znaków"),
  topic: z.string().trim().min(1, "Napisz, o czym chcesz porozmawiać").max(1000, "Maksymalnie 1000 znaków"),
  story: z.string().trim().min(20, "Opowiedz swoją historię (co najmniej 20 znaków)").max(5000, "Maksymalnie 5000 znaków"),
  why: z.string().trim().max(2000, "Maksymalnie 2000 znaków"),
  profile_url: z.string().trim().max(500, "Maksymalnie 500 znaków"),
  consent: z.literal(true, { errorMap: () => ({ message: "Zaznacz zgodę na kontakt" }) }),
});
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submitVoiceStory"), data: storySchema.extend({ website: z.string().max(0).optional().default(""), elapsedMs: z.number().int().nonnegative() }) }),
  z.object({ action: z.literal("adminListSubmissions") }),
  z.object({ action: z.literal("adminUpdateSubmission"), data: z.object({ id: z.string().uuid(), status: z.enum(SUBMISSION_STATUSES), admin_note: z.string().max(5000) }) }),
  z.object({ action: z.literal("listInstagram") }),
  z.object({ action: z.literal("adminGetInstagram") }),
  z.object({ action: z.literal("adminCheckInstagramConfig") }),
  z.object({ action: z.literal("adminStartInstagramConnect"), data: z.object({ origin: z.string().url().max(200).refine((value) => /^https:\/\//.test(value) || /^http:\/\/localhost(:\d+)?$/.test(value), "Nieprawidłowy adres") }) }),
  z.object({ action: z.literal("adminSyncInstagram") }),
  z.object({ action: z.literal("adminDisconnectInstagram") }),
  z.object({ action: z.literal("adminSaveInstagramOptions"), data: z.object({ show_reels: z.boolean(), show_posts: z.boolean(), show_carousels: z.boolean(), display_count: z.number().int().min(1).max(12) }) }),
  z.object({ action: z.literal("finishInstagramOAuth"), data: z.object({ state: z.string().min(20).max(200), code: z.string().min(1).max(2000) }) }),
  z.object({ action: z.literal("cronInstagramSync") })
]);

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
class IgError extends Error {}
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: CORS }); }
function envSecret(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name); if (!raw) continue;
    try { const value = JSON.parse(raw); if (typeof value === "string") return value; if (value && typeof value.default === "string") return value.default; }
    catch { return raw; }
  }
  return null;
}
function makeClient(key: string, authorization?: string) {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new HttpError(503, "Usługa Głosu TNB jest niedostępna.");
  return createClient(url, key, {
    global: { headers: authorization ? { Authorization: authorization } : {}, fetch: (input, init) => {
      const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
      if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
      if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
      headers.set("apikey", key); return fetch(input, { ...init, headers });
    } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}
function service() {
  const key = envSecret("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new HttpError(503, "Usługa Głosu TNB jest niedostępna.");
  return makeClient(key);
}
type Db = ReturnType<typeof service>;
async function requireAdmin(s: Db, req: Request) {
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const { data, error } = await s.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const { data: allowed, error: roleError } = await s.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  if (roleError || !allowed) {
    await logEvent(s, { type: "access_denied", actor: data.user.id, result: "denied" });
    throw new HttpError(403, "Brak uprawnień administratora.");
  }
  return { id: data.user.id, email: data.user.email ?? null };
}
async function logEvent(s: Db, e: { type: string; actor?: string | null; objectKind?: string | null; objectId?: string | null; result?: "ok" | "failed" | "denied"; detail?: string | null }) {
  try { await s.from("admin_events").insert({ type: e.type, actor: e.actor ?? null, object_kind: e.objectKind ?? null, object_id: e.objectId ?? null, result: e.result ?? "ok", detail: e.detail?.slice(0, 300) ?? null }); }
  catch (error) { console.error("voice admin event log failed", error); }
}
async function notificationContext(s: Db) {
  const [{ data: settings }, { data: platform }] = await Promise.all([
    s.from("email_settings").select("*").eq("id", 1).maybeSingle(),
    s.from("platform_settings").select("platform_name").eq("id", 1).maybeSingle()
  ]);
  return { settings, platform: platform?.platform_name || "Tata Na Baczności" };
}
async function notifyVoiceSubmission(s: Db, input: { id: string; name: string; email: string; topic: string }) {
  try {
    const eventKey = "voice_submission_admin", event = EVENT_MAP[eventKey], def = DEFAULT_TEMPLATES[eventKey];
    if (!event || !def) return;
    const { settings, platform } = await notificationContext(s);
    const to = event.recipient === "admin" ? settings?.notification_recipient : input.email;
    const base = { kind: eventKey, related_id: input.id, template_key: eventKey, idempotency_key: eventKey + "-" + input.id };
    const insert = async (row: Record<string, unknown>) => {
      const { data, error } = await s.from("email_notification_log").insert({ ...base, mode: "test", ...row }).select("id").single();
      if (error) { if (error.code === "23505") return null; throw error; }
      return data.id as string;
    };
    if (event.integration !== "integrated" || !EMAIL.test(String(to ?? ""))) {
      await insert({ status: "skipped", reason: event.integration !== "integrated" ? "event_not_integrated" : "recipient_not_configured", recipient: to ?? null });
      return;
    }
    const { data: rule } = await s.from("notification_rules").select("enabled").eq("event_key", eventKey).maybeSingle();
    if (rule?.enabled === false) { await insert({ status: "skipped", reason: "notification_disabled", recipient: to }); return; }
    const { data: custom } = await s.from("email_templates").select("subject,html,text_body").eq("key", eventKey).maybeSingle();
    const tpl = { key: eventKey, required: def.required, subject: custom?.subject ?? def.subject, html: custom?.html ?? def.html, text: custom?.text_body ?? def.text };
    const vars: Vars = { imie: input.name, email: input.email, temat_wiadomosci: input.topic.slice(0, 120), link_do_panelu: "https://tatanabacznosci.pl/admin/zgloszenia-glos", nazwa_platformy: platform };
    const rendered = render(tpl, vars, tpl.required);
    if (!rendered.ok) { await insert({ status: "failed", reason: "missing_variables:" + rendered.missing.join(","), recipient: to, payload: stripSensitive(vars), retryable: true }); return; }
    const id = await insert({ status: "sending", recipient: to, payload: stripSensitive(vars), retryable: !rendered.usesSensitive });
    if (!id) return;
    const safe = render(tpl, maskSensitive(vars), tpl.required);
    await s.from("email_notification_log").update({
      status: "simulated", reason: null, attempts: 1, mode: "test", updated_at: new Date().toISOString(),
      rendered_subject: safe.ok ? safe.subject : null, rendered_html: safe.ok ? safe.html : null, rendered_text: safe.ok ? safe.text : null
    }).eq("id", id);
  } catch (error) { console.error("voice submission notification failed", error instanceof Error ? error.message : error); }
}
function instagramApp() {
  const id = envSecret("INSTAGRAM_APP_ID"), secret = envSecret("INSTAGRAM_APP_SECRET");
  if (!id || !secret) throw new IgError("Brak konfiguracji aplikacji Meta (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET).");
  return { id, secret };
}
function productionOrigin() {
  const value = (Deno.env.get("SITE_PRODUCTION_URL") ?? "").trim();
  try { const url = new URL(value); return url.protocol === "https:" ? url.origin : null; } catch { return null; }
}
function appConfigured() { return !!(envSecret("INSTAGRAM_APP_ID") && envSecret("INSTAGRAM_APP_SECRET")); }
async function igJson(response: Response) {
  const body = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: { message?: string } | string; error_message?: string };
  if (!response.ok || body.error) {
    const message = typeof body.error === "string" ? body.error_message ?? body.error : body.error?.message ?? body.error_message ?? "HTTP " + response.status;
    throw new IgError("Instagram API: " + message);
  }
  return body as { access_token?: string; expires_in?: number; user_id?: string | number; id?: string; username?: string; data?: unknown };
}
async function checkConfig(s: Db) {
  const id = envSecret("INSTAGRAM_APP_ID") ?? "", secret = envSecret("INSTAGRAM_APP_SECRET") ?? "";
  const { data: row } = await s.from("instagram_secret").select("id").eq("id", 1).maybeSingle();
  const checks = [
    { key: "app_id", label: "Instagram App ID zapisany", ok: !!id, hint: id && !/^\d{6,25}$/.test(id) ? "App ID powinien składać się z samych cyfr." : undefined },
    { key: "app_secret", label: "Instagram App Secret zapisany (tylko na serwerze)", ok: secret.length >= 16 },
    { key: "server", label: "Konfiguracja serwerowa (magazyn tokenu)", ok: !!row },
    { key: "callback", label: "Adres zwrotny (callback) przygotowany", ok: true },
    { key: "prod", label: "Domena produkcyjna ustawiona", ok: !!productionOrigin(), optional: true }
  ];
  return { ok: checks.filter((check) => !check.optional).every((check) => check.ok && !check.hint), checks };
}
async function startOAuth(s: Db, origin: string, actor: string) {
  const { id } = instagramApp();
  const state = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const redirect = origin + CALLBACK_PATH;
  const { error } = await s.from("instagram_secret").update({
    oauth_state: state, oauth_state_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    oauth_redirect: redirect, oauth_actor: actor, updated_at: new Date().toISOString()
  }).eq("id", 1);
  if (error) throw new IgError("Nie udało się przygotować połączenia z Instagramem.");
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", id); url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code"); url.searchParams.set("scope", "instagram_business_basic"); url.searchParams.set("state", state);
  return url.toString();
}
async function finishOAuth(s: Db, state: string, code: string) {
  const now = new Date().toISOString();
  const { data: row, error } = await s.from("instagram_secret").update({ oauth_state: null, oauth_state_expires_at: null })
    .eq("id", 1).eq("oauth_state", state).gt("oauth_state_expires_at", now)
    .select("oauth_redirect,oauth_actor").maybeSingle();
  if (error || !row?.oauth_redirect) throw new IgError("Nieprawidłowy lub wygasły parametr autoryzacji.");
  const { id, secret } = instagramApp();
  const short = await igJson(await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "authorization_code", redirect_uri: row.oauth_redirect, code: code.replace(/#_$/, "") })
  }));
  const long = await igJson(await fetch(GRAPH + "/access_token?" + new URLSearchParams({
    grant_type: "ig_exchange_token", client_secret: secret, access_token: String(short.access_token)
  })));
  const token = String(long.access_token);
  const me = await igJson(await fetch(GRAPH + "/me?" + new URLSearchParams({ fields: "user_id,username", access_token: token })));
  const connectedAt = new Date().toISOString();
  const [{ error: secretError }, { error: sourceError }] = await Promise.all([
    s.from("instagram_secret").update({ access_token: token, token_expires_at: new Date(Date.now() + Number(long.expires_in ?? 5_184_000) * 1000).toISOString(), updated_at: connectedAt }).eq("id", 1),
    s.from("instagram_source").update({
      status: "ok", ig_user_id: String(me.user_id ?? me.id), username: String(me.username),
      profile_url: "https://www.instagram.com/" + String(me.username) + "/", connected_at: connectedAt,
      connected_by: row.oauth_actor, last_error: null, updated_at: connectedAt
    }).eq("id", 1)
  ]);
  if (secretError || sourceError) throw new IgError("Instagram połączył konto, ale nie udało się zapisać ustawień.");
  await logEvent(s, { type: "instagram_connect", actor: row.oauth_actor, objectKind: "instagram_source", detail: "@" + String(me.username) });
  return { username: String(me.username) };
}
type InstagramMediaItem = { id: string; media_type: string; media_product_type?: string; media_url?: string; thumbnail_url?: string; permalink: string; caption?: string; timestamp: string };
async function syncInstagram(s: Db) {
  const [{ data: secretRow }, { data: source }] = await Promise.all([
    s.from("instagram_secret").select("access_token,token_expires_at").eq("id", 1).maybeSingle(),
    s.from("instagram_source").select("show_reels,show_posts,show_carousels").eq("id", 1).maybeSingle()
  ]);
  if (!secretRow?.access_token) throw new IgError("Konto Instagram nie jest połączone.");
  let token = secretRow.access_token;
  try {
    if (secretRow.token_expires_at && new Date(secretRow.token_expires_at).getTime() - Date.now() < 10 * 86_400_000) {
      const refreshed = await igJson(await fetch(GRAPH + "/refresh_access_token?" + new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token })));
      token = String(refreshed.access_token);
      await s.from("instagram_secret").update({
        access_token: token, token_expires_at: new Date(Date.now() + Number(refreshed.expires_in ?? 5_184_000) * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }).eq("id", 1);
    }
    const response = await igJson(await fetch(GRAPH + "/me/media?" + new URLSearchParams({
      fields: "id,media_type,media_product_type,media_url,thumbnail_url,permalink,caption,timestamp", limit: "50", access_token: token
    })));
    const items = ((response.data as InstagramMediaItem[]) ?? []).filter((item) => {
      const reel = item.media_product_type === "REELS";
      if (reel) return source?.show_reels ?? true;
      if (item.media_type === "CAROUSEL_ALBUM") return !!source?.show_carousels;
      return !!source?.show_posts && item.media_type === "IMAGE";
    });
    const { data: existing } = await s.from("instagram_media").select("ig_id");
    const known = new Set((existing ?? []).map((item: { ig_id: string }) => item.ig_id));
    const rows = items.map((item) => ({
      ig_id: item.id, media_type: item.media_type, product_type: item.media_product_type ?? null,
      thumbnail_url: item.thumbnail_url ?? (item.media_type === "VIDEO" ? null : item.media_url ?? null),
      permalink: item.permalink, caption: (item.caption ?? "").slice(0, 500), posted_at: item.timestamp, synced_at: new Date().toISOString()
    }));
    if (rows.length) {
      const { error } = await s.from("instagram_media").upsert(rows, { onConflict: "ig_id" });
      if (error) throw new IgError("Zapis materiałów nie powiódł się.");
    }
    const keep = rows.map((item) => item.ig_id);
    if (keep.length) await s.from("instagram_media").delete().not("ig_id", "in", "(" + keep.map((id) => '"' + id + '"').join(",") + ")");
    else await s.from("instagram_media").delete().neq("ig_id", "");
    const added = keep.filter((id) => !known.has(id)).length, now = new Date().toISOString();
    await s.from("instagram_source").update({ status: "ok", last_sync_at: now, last_sync_added: added, media_count: rows.length, last_error: null }).eq("id", 1);
    return { added, total: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Błąd synchronizacji Instagram";
    await s.from("instagram_source").update({ status: "error", last_error: message.slice(0, 500), last_sync_at: new Date().toISOString() }).eq("id", 1);
    throw error instanceof IgError ? error : new IgError(message);
  }
}
async function syncIfStale(s: Db) {
  const { data } = await s.from("instagram_source").select("status,last_sync_at").eq("id", 1).maybeSingle();
  if (!data || data.status === "disconnected") return;
  if (data.last_sync_at && Date.now() - new Date(data.last_sync_at).getTime() < STALE_MS) return;
  await syncInstagram(s).catch(() => {});
}

async function requireCron(req: Request) {
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer ([^\s,]+)$/)?.[1] ?? "";
  if (!token) throw new HttpError(401, "Unauthorized");
  const secrets = ["LOVABLE_CRON_SECRET", "TNB_CRON_SECRET", "LOVABLE_CRON_SECRET_PREVIOUS", "TNB_CRON_SECRET_PREVIOUS"]
    .map((name) => envSecret(name)).filter((value): value is string => !!value);
  if (!secrets.length) throw new HttpError(503, "Zadanie cykliczne nie jest skonfigurowane.");
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const provided = await digest(token);
  let matched = false;
  for (const secret of secrets) {
    const expected = await digest(secret);
    let diff = token.length ^ secret.length;
    for (let i = 0; i < expected.length; i++) diff |= provided[i]! ^ expected[i]!;
    matched = matched || diff === 0;
  }
  if (!matched) throw new HttpError(401, "Unauthorized");
}

async function handle(s: Db, req: Request, raw: unknown) {
  const input = RequestSchema.parse(raw);
  if (input.action === "cronInstagramSync") {
    await requireCron(req);
    await syncIfStale(s);
    return { ok: true as const };
  }
  const adminActions = new Set(["adminListSubmissions","adminUpdateSubmission","adminGetInstagram","adminCheckInstagramConfig","adminStartInstagramConnect","adminSyncInstagram","adminDisconnectInstagram","adminSaveInstagramOptions"]);
  const actor = adminActions.has(input.action) ? await requireAdmin(s, req) : null;
  switch (input.action) {
    case "submitVoiceStory": {
      const data = input.data;
      if (data.website || data.elapsedMs < 2500) throw new HttpError(400, "Zgłoszenie odrzucone przez filtr antyspamowy.");
      const { data: row, error } = await s.from("voice_submissions").insert({
        name: data.name, email: data.email, phone: data.phone || null, about: data.about, topic: data.topic,
        story: data.story, why: data.why, profile_url: data.profile_url || null, contact_consent: true
      }).select("id").single();
      if (error || !row) { console.error("voice submission insert failed", error?.message); throw new HttpError(500, "Nie udało się zapisać zgłoszenia."); }
      await notifyVoiceSubmission(s, { id: row.id, name: data.name, email: data.email, topic: data.topic });
      return { ok: true as const };
    }
    case "adminListSubmissions": {
      const { data, error } = await s.from("voice_submissions").select("id,name,email,phone,about,topic,story,why,profile_url,status,admin_note,created_at,updated_at").order("created_at", { ascending: false }).limit(500);
      if (error) throw new HttpError(500, "Nie udało się pobrać zgłoszeń.");
      return data ?? [];
    }
    case "adminUpdateSubmission": {
      const d = input.data;
      const { error } = await s.from("voice_submissions").update({ status: d.status, admin_note: d.admin_note, updated_at: new Date().toISOString() }).eq("id", d.id);
      if (error) throw new HttpError(500, "Nie udało się zapisać zmian.");
      await logEvent(s, { type: "voice_submission_update", actor: actor!.id, objectKind: "voice_submission", objectId: d.id, detail: "status: " + d.status });
      return { ok: true as const };
    }
    case "listInstagram": {
      await syncIfStale(s);
      const { data: source } = await s.from("instagram_source").select("status,username,profile_url,display_count").eq("id", 1).maybeSingle();
      const connected = !!source && source.status !== "disconnected" && !!source.username;
      if (!connected) return { connected: false, username: null, profileUrl: null, items: [] };
      const { data } = await s.from("instagram_media").select("id,media_type,product_type,thumbnail_url,permalink,caption,posted_at")
        .not("thumbnail_url", "is", null).order("posted_at", { ascending: false }).limit(source.display_count);
      return { connected, username: source.username, profileUrl: source.profile_url, items: data ?? [] };
    }
    case "adminGetInstagram": {
      const { data, error } = await s.from("instagram_source").select("*").eq("id", 1).maybeSingle();
      if (error) throw new HttpError(500, "Nie udało się pobrać ustawień Instagrama.");
      const origin = productionOrigin();
      return { ...data, appConfigured: appConfigured(), callbackPath: CALLBACK_PATH, productionCallback: origin ? origin + CALLBACK_PATH : null };
    }
    case "adminCheckInstagramConfig": {
      const result = await checkConfig(s);
      await logEvent(s, { type: "instagram_config_check", actor: actor!.id, objectKind: "instagram_source", result: result.ok ? "ok" : "failed", detail: result.checks.filter((check) => !check.ok).map((check) => check.key).join(",") || "komplet" });
      return result;
    }
    case "adminStartInstagramConnect": {
      const origin = new URL(input.data.origin).origin;
      const url = await startOAuth(s, origin, actor!.id);
      await logEvent(s, { type: "instagram_connect_start", actor: actor!.id, objectKind: "instagram_source" });
      return { url };
    }
    case "adminSyncInstagram": {
      try {
        const result = await syncInstagram(s);
        await logEvent(s, { type: "instagram_sync", actor: actor!.id, detail: "nowe " + result.added + ", razem " + result.total });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Błąd synchronizacji";
        await logEvent(s, { type: "instagram_sync", actor: actor!.id, result: "failed", detail: message });
        throw new HttpError(500, message);
      }
    }
    case "adminDisconnectInstagram": {
      await Promise.all([
        s.from("instagram_secret").update({ access_token: null, token_expires_at: null, oauth_state: null, oauth_state_expires_at: null, updated_at: new Date().toISOString() }).eq("id", 1),
        s.from("instagram_source").update({ status: "disconnected", ig_user_id: null, username: null, profile_url: null, connected_at: null, last_error: null, media_count: 0, updated_at: new Date().toISOString() }).eq("id", 1)
      ]);
      await s.from("instagram_media").delete().neq("ig_id", "");
      await logEvent(s, { type: "instagram_disconnect", actor: actor!.id, objectKind: "instagram_source" });
      return { ok: true as const };
    }
    case "adminSaveInstagramOptions": {
      const { error } = await s.from("instagram_source").update({ ...input.data, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw new HttpError(500, "Nie udało się zapisać ustawień.");
      await logEvent(s, { type: "instagram_options", actor: actor!.id, objectKind: "instagram_source", detail: JSON.stringify(input.data) });
      return { ok: true as const };
    }
    case "finishInstagramOAuth": {
      const result = await finishOAuth(s, input.data.state, input.data.code);
      await syncInstagram(s).catch(() => {});
      return { ok: true as const, username: result.username };
    }
  }
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // Meta redirects the browser to the existing site callback URL. Static hosting
  // forwards that GET to this function; the single-use state remains the trust boundary.
  if (req.method === "GET") {
    const url = new URL(req.url);
    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    let appOrigin = productionOrigin() ?? "https://tatanabacznosci.pl";
    let db: ReturnType<typeof service> | null = null;
    const back = (result: "polaczono" | "anulowano" | "blad") => {
      const target = new URL("/admin/podcast", appOrigin);
      target.searchParams.set("instagram", result);
      target.hash = "instagram";
      return new Response(null, { status: 302, headers: {
        Location: target.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer"
      } });
    };
    try {
      db = service();
      if (state) {
        const { data: pending } = await db.from("instagram_secret").select("oauth_redirect")
          .eq("id", 1).eq("oauth_state", state).maybeSingle();
        if (pending?.oauth_redirect) {
          try { appOrigin = new URL(pending.oauth_redirect).origin; } catch { /* keep configured fallback */ }
        }
      }
      if (url.searchParams.has("error") || !state || !code) return back("anulowano");
      await handle(db, req, { action: "finishInstagramOAuth", data: { state, code } });
      return back("polaczono");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Błąd OAuth Instagram";
      console.error("tnb-voice OAuth callback:", message);
      if (db) await logEvent(db, { type: "instagram_connect", objectKind: "instagram_source", result: "failed", detail: message.slice(0, 300) }).catch(() => {});
      return back("blad");
    }
  }

  if (req.method !== "POST") return json({ message: "Niedozwolona metoda." }, 405);
  try {
    const s = service(), body = await req.json().catch(() => null);
    return json(await handle(s, req, body));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : error instanceof IgError ? 409 : 500;
    const message = error instanceof Error ? error.message : "Wystąpił błąd serwera.";
    if (status >= 500) console.error("tnb-voice:", message);
    return json({ message }, status);
  }
});
