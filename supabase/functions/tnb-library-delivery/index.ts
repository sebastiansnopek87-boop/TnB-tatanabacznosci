import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "zod";
import { EVENT_MAP, DEFAULT_TEMPLATES } from "./registry.ts";
import { render, maskSensitive, stripSensitive, type Vars } from "./render.ts";
import { sendSmtpMail, smtpConfig } from "../_shared/smtp.ts";

const CORS = new Headers({ ...corsHeaders, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version", "Access-Control-Max-Age": "86400", "X-Content-Type-Options": "nosniff" });
const BUCKET = "library-files";
const TTL_H = { form_download: 24, email: 72 } as const;
const FREE_CONSENT_TEXT = "Wyrażam zgodę na przetwarzanie moich danych (imię, nazwisko, adres e-mail) przez TATA NA BACZNOŚCI wyłącznie w celu udostępnienia wybranego bezpłatnego materiału. Dane są przechowywane do 12 miesięcy, potem usuwane. Zapoznałem się z Polityką prywatności.";
const PRIVACY_VERSION = "2026-10-01";
const EMAIL = /^[^\s@<>"]+@[^\s@<>]+\.[a-z]{2,}$/i;

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: CORS }); }
function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try { const value = JSON.parse(raw); if (typeof value === "string") return value; if (value && typeof value.default === "string") return value.default; }
    catch { return raw; }
  }
  return null;
}
function db() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new HttpError(503, "Usługa pobierania materiałów jest niedostępna.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
    headers.set("apikey", key); return fetch(input, { ...init, headers });
  } } });
}
type Db = ReturnType<typeof db>;
type User = { id: string };
async function requireAdmin(s: Db, req: Request): Promise<User> {
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const { data, error } = await s.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const user = data.user;
  const { data: allowed, error: roleError } = await s.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (roleError || !allowed) {
    await logEvent(s, { type: "access_denied", actor: user.id, result: "denied" });
    throw new HttpError(403, "Brak uprawnień administratora.");
  }
  return { id: user.id };
}
async function logEvent(s: Db, e: { type: string; actor?: string | null; objectKind?: string | null; objectId?: string | null; result?: "ok" | "failed" | "denied"; detail?: string | null }) {
  try { await s.from("admin_events").insert({ type: e.type, actor: e.actor ?? null, object_kind: e.objectKind ?? null, object_id: e.objectId ?? null, result: e.result ?? "ok", detail: e.detail?.slice(0, 300) ?? null }); }
  catch (error) { console.error("library delivery event log failed", error); }
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hashIp(ip: string | null) { return ip ? sha256("tnb:" + ip) : null; }
async function notificationContext(s: Db) {
  const [{ data: settings }, { data: platform }] = await Promise.all([
    s.from("email_settings").select("*").eq("id", 1).maybeSingle(),
    s.from("platform_settings").select("platform_name").eq("id", 1).maybeSingle()
  ]);
  return { settings, platform: platform?.platform_name || "Tata Na Baczności" };
}
async function dispatchFreeMaterial(s: Db, input: { to: string; firstName: string; title: string; summary: string; link: string; id: string }) {
  const key = "library_free_material", event = EVENT_MAP[key];
  if (!event || event.integration !== "integrated") return { status: "failed" as const, reason: "event_not_integrated" };
  const [{ settings, platform }, { data: rule }] = await Promise.all([
    notificationContext(s), s.from("notification_rules").select("enabled").eq("event_key", key).maybeSingle()
  ]);
  const smtp = smtpConfig();
  const mode = settings?.delivery_mode === "live" && smtp.configured ? "live" : "test";
  const base = { kind: key, related_id: input.id, template_key: key, idempotency_key: "library-free-" + input.id };
  const insert = async (row: Record<string, unknown>) => {
    const { data, error } = await s.from("email_notification_log").insert({ ...base, mode, ...row }).select("id").single();
    if (error) { if (error.code === "23505") return null; throw error; }
    return data.id as string;
  };
  if (rule?.enabled === false) {
    const id = await insert({ status: "skipped", reason: "notification_disabled", recipient: null });
    return id ? { status: "skipped" as const, id, reason: "notification_disabled" } : { status: "duplicate" as const };
  }
  if (!EMAIL.test(input.to)) {
    const id = await insert({ status: "skipped", reason: "recipient_not_configured", recipient: null });
    return id ? { status: "skipped" as const, id, reason: "recipient_not_configured" } : { status: "duplicate" as const };
  }
  const def = DEFAULT_TEMPLATES[key];
  if (!def) return { status: "failed" as const, reason: "template_not_found" };
  const { data: custom } = await s.from("email_templates").select("subject,html,text_body").eq("key", key).maybeSingle();
  const tpl = { key, required: def.required, subject: custom?.subject ?? def.subject, html: custom?.html ?? def.html, text: custom?.text_body ?? def.text };
  const vars: Vars = {
    imie: input.firstName, tytul_materialu: input.title, opis_materialu: input.summary || input.title,
    waznosc_linku: TTL_H.email + " godziny", link_do_materialu: input.link, nazwa_platformy: platform
  };
  const rendered = render(tpl, vars, tpl.required);
  if (!rendered.ok) {
    const id = await insert({ status: "failed", reason: "missing_variables:" + rendered.missing.join(","), recipient: input.to, payload: stripSensitive(vars), retryable: true });
    return id ? { status: "failed" as const, id, reason: "missing_variables" } : { status: "duplicate" as const };
  }
  const id = await insert({ status: "sending", recipient: input.to, payload: stripSensitive(vars), retryable: !rendered.usesSensitive });
  if (!id) return { status: "duplicate" as const };
  if (mode === "test") {
    const safe = render(tpl, maskSensitive(vars), tpl.required);
    await s.from("email_notification_log").update({
      status: "simulated", reason: null, attempts: 1, mode: "test", updated_at: new Date().toISOString(),
      rendered_subject: safe.ok ? safe.subject : null, rendered_html: safe.ok ? safe.html : null, rendered_text: safe.ok ? safe.text : null
    }).eq("id", id);
    return { status: "simulated" as const, id };
  }
  try {
    const from = `${settings?.sender_name ?? "Tata Na Baczności"} <${settings?.sender_local_part ?? "kontakt"}@${settings?.sender_domain ?? "tatanabacznosci.pl"}>`;
    const sent = await sendSmtpMail({ to: input.to, from, replyTo: settings?.reply_to ?? null, subject: rendered.subject, html: rendered.html, text: rendered.text });
    await s.from("email_notification_log").update({ status: "sent", reason: null, attempts: 1, mode: "live", provider_message_id: sent.messageId, updated_at: new Date().toISOString() }).eq("id", id);
    return { status: "sent" as const, id };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 300) : "smtp_delivery_failed";
    await s.from("email_notification_log").update({ status: "failed", reason, attempts: 1, mode: "live", updated_at: new Date().toISOString() }).eq("id", id);
    return { status: "failed" as const, id, reason: "smtp_delivery_failed" };
  }
}

const Name = (message: string, max = 60) => z.string().trim().min(1, message).max(max).regex(/^[\p{L}][\p{L}\s'.-]*$/u, "Pole zawiera niedozwolone znaki.");
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("requestFreeMaterial"), data: z.object({
    slug: z.string().max(120),
    firstName: Name("Podaj imię."),
    lastName: Name("Podaj nazwisko.", 80),
    email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
    consent: z.literal(true, { errorMap: () => ({ message: "Zaakceptuj informację o przetwarzaniu danych." }) }),
    website: z.string().max(0).optional().default(""),
    elapsedMs: z.number().int().nonnegative()
  }) }),
  z.object({ action: z.literal("redeemFreeMaterial"), data: z.object({ token: z.string().min(20).max(100) }) }),
  z.object({ action: z.literal("adminListLibraryRequests"), data: z.object({
    itemId: z.string().uuid().nullable().default(null),
    email: z.string().trim().max(100).default(""),
    mode: z.enum(["direct", "form_download", "email"]).nullable().default(null),
    status: z.string().max(20).nullable().default(null)
  }) }),
  z.object({ action: z.literal("adminEraseLibraryRequest"), data: z.object({ id: z.string().uuid() }) })
]);
async function handle(s: Db, req: Request, raw: unknown) {
  const input = RequestSchema.parse(raw);
  if (input.action === "requestFreeMaterial") {
    const data = input.data;
    const { data: item } = await s.from("library_items").select("id,title,summary,access,status,free_delivery").eq("slug", data.slug).maybeSingle();
    if (!item || item.status !== "published" || item.access !== "public" || item.free_delivery === "direct") throw new HttpError(400, "Ten materiał nie jest dostępny przez formularz.");
    const mode = item.free_delivery as "form_download" | "email";
    if (data.website || data.elapsedMs < 2500) {
      if (mode === "email") return { mode };
      throw new HttpError(400, "Spróbuj ponownie za chwilę.");
    }
    const { data: content } = await s.from("library_item_content").select("file_path").eq("item_id", item.id).maybeSingle();
    if (!content?.file_path) throw new HttpError(409, "Materiał jest chwilowo niedostępny.");
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ipHash = await hashIp(ip);
    if (ipHash) {
      const { count, error } = await s.from("library_requests").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", new Date(Date.now() - 60 * 60_000).toISOString());
      if (error) throw new HttpError(500, "Nie udało się przyjąć zgłoszenia.");
      if ((count ?? 0) >= 10) throw new HttpError(429, "Wysłano zbyt wiele zgłoszeń. Spróbuj ponownie później.");
    }
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: recent } = await s.from("library_requests").select("id").eq("item_id", item.id).eq("email", data.email).eq("mode", mode).gte("created_at", since).limit(1).maybeSingle();
    const token = newToken(), expires = new Date(Date.now() + TTL_H[mode] * 3600_000).toISOString();
    if (recent) {
      if (mode === "email") return { mode };
      const { error } = await s.from("library_requests").update({ token_hash: await sha256(token), token_expires_at: expires, updated_at: new Date().toISOString() }).eq("id", recent.id);
      if (error) throw new HttpError(500, "Nie udało się odświeżyć linku pobierania.");
      return { mode, token };
    }
    const now = new Date().toISOString();
    const { data: row, error } = await s.from("library_requests").insert({
      item_id: item.id, item_title: item.title, mode, status: mode === "email" ? "pending_send" : "download_ready",
      first_name: data.firstName, last_name: data.lastName, email: data.email, consent_text: FREE_CONSENT_TEXT,
      privacy_version: PRIVACY_VERSION, consent_at: now, token_hash: await sha256(token), token_expires_at: expires, ip_hash: ipHash
    }).select("id").single();
    if (error || !row) throw new HttpError(500, "Nie udało się przyjąć zgłoszenia. Spróbuj ponownie.");
    if (mode === "form_download") return { mode, token };
    const origin = (Deno.env.get("PUBLIC_SITE_URL") || "https://tatanabacznosci.pl").replace(/\/+$/, "");
    const result = await dispatchFreeMaterial(s, {
      id: row.id, to: data.email, firstName: data.firstName, title: item.title, summary: item.summary || item.title,
      link: origin + "/biblioteka/pobierz?t=" + token
    });
    const status = result.status === "sent" ? "sent" : result.status === "simulated" ? "simulated" : result.status === "duplicate" ? "pending_send" : "send_failed";
    await s.from("library_requests").update({
      status, notification_log_id: result.id ?? null, notification_status: result.status + (result.reason ? ":" + result.reason : ""),
      updated_at: new Date().toISOString()
    }).eq("id", row.id);
    return { mode };
  }
  if (input.action === "redeemFreeMaterial") {
    const { data: request } = await s.from("library_requests").select("id,item_id,token_expires_at,download_count,status")
      .eq("token_hash", await sha256(input.data.token)).maybeSingle();
    if (!request || request.status === "cancelled") return { status: "invalid" as const };
    if (!request.token_expires_at || new Date(request.token_expires_at) < new Date()) {
      if (request.status !== "downloaded") await s.from("library_requests").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", request.id);
      return { status: "expired" as const };
    }
    const [{ data: item }, { data: content }] = await Promise.all([
      s.from("library_items").select("title,status,access").eq("id", request.item_id).maybeSingle(),
      s.from("library_item_content").select("file_path,file_name").eq("item_id", request.item_id).maybeSingle()
    ]);
    if (!item || item.status !== "published" || item.access !== "public" || !content?.file_path) return { status: "unavailable" as const };
    const { data: signed, error } = await s.storage.from(BUCKET).createSignedUrl(content.file_path, 300, { download: content.file_name ?? "material.pdf" });
    if (error || !signed) return { status: "unavailable" as const };
    const now = new Date().toISOString();
    await s.from("library_requests").update({ status: "downloaded", downloaded_at: now, download_count: request.download_count + 1, updated_at: now }).eq("id", request.id);
    return { status: "ok" as const, url: signed.signedUrl, title: item.title };
  }
  const actor = await requireAdmin(s, req);
  if (input.action === "adminListLibraryRequests") {
    const { error: cleanupError } = await s.from("library_requests").delete().lt("retention_until", new Date().toISOString());
    if (cleanupError) throw new HttpError(500, "Nie udało się wykonać retencji danych.");
    let query = s.from("library_requests").select("id,item_id,item_title,mode,status,user_id,first_name,last_name,email,consent_text,privacy_version,consent_at,token_expires_at,downloaded_at,download_count,notification_status,retention_until,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(300);
    if (input.data.itemId) query = query.eq("item_id", input.data.itemId);
    if (input.data.mode) query = query.eq("mode", input.data.mode);
    if (input.data.status) query = query.eq("status", input.data.status);
    const email = input.data.email.replace(/[%,()*\\]/g, "");
    if (email.length >= 2) query = query.ilike("email", "%" + email + "%");
    const { data, error } = await query;
    if (error) throw new HttpError(500, "Nie udało się pobrać historii.");
    return data ?? [];
  }
  if (input.action === "adminEraseLibraryRequest") {
    const { error } = await s.from("library_requests").update({
      first_name: null, last_name: null, email: null, ip_hash: null, token_hash: null, status: "cancelled", updated_at: new Date().toISOString()
    }).eq("id", input.data.id);
    await logEvent(s, { type: "library_request_erased", actor: actor.id, objectKind: "library_request", objectId: input.data.id, result: error ? "failed" : "ok" });
    if (error) throw new HttpError(500, "Nie udało się usunąć danych.");
    return { ok: true as const };
  }
  throw new HttpError(400, "Nieznana operacja.");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ message: "Niedozwolona metoda." }, 405);
  try {
    const s = db(), body = await req.json().catch(() => null);
    return json(await handle(s, req, body));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Wystąpił błąd serwera.";
    if (status >= 500) console.error("tnb-library-delivery:", message);
    return json({ message }, status);
  }
});
