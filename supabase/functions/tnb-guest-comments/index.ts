import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "zod";
import { EVENT_MAP, DEFAULT_TEMPLATES } from "./registry.ts";
import { render, maskSensitive, stripSensitive, type Vars } from "./render.ts";

const CORS = new Headers({ ...corsHeaders, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version", "Access-Control-Max-Age": "86400", "X-Content-Type-Options": "nosniff" });
const TTL_HOURS = 48, MAX_SENDS = 3;
const GUEST_COMMENT_RULES = "Akceptuję zasady komentowania: piszę z szacunkiem, bez ataków personalnych i danych wrażliwych. Moderator może ukryć komentarz naruszający zasady.";
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
  if (!url || !key) throw new HttpError(503, "Usługa komentarzy jest chwilowo niedostępna.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
    headers.set("apikey", key); return fetch(input, { ...init, headers });
  } } });
}
type Db = ReturnType<typeof db>;
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hashIp(ip: string | null) {
  if (!ip) return null;
  return sha256("tnb:" + ip);
}
async function logEvent(s: Db, event: { type: string; actor?: string | null; objectKind?: string | null; objectId?: string | null; result?: "ok" | "failed" | "denied"; detail?: string | null }) {
  try {
    await s.from("admin_events").insert({ type: event.type, actor: event.actor ?? null, object_kind: event.objectKind ?? null, object_id: event.objectId ?? null, result: event.result ?? "ok", detail: event.detail?.slice(0, 300) ?? null });
  } catch (error) { console.error("guest comment event log failed", error); }
}
async function notificationContext(s: Db) {
  const [{ data: settings }, { data: platform }] = await Promise.all([
    s.from("email_settings").select("*").eq("id", 1).maybeSingle(),
    s.from("platform_settings").select("platform_name").eq("id", 1).maybeSingle()
  ]);
  return { settings, platform: platform?.platform_name || "Tata Na Baczności" };
}
async function dispatchConfirmation(s: Db, input: { to: string; vars: Vars; idempotencyKey: string; relatedId: string }) {
  try {
    const event = EVENT_MAP["article_comment_confirm"];
    if (!event) return { status: "failed" as const, reason: "unknown_event" };
    const { settings, platform } = await notificationContext(s);
    const base = { kind: "article_comment_confirm", related_id: input.relatedId, template_key: "article_comment_confirm", idempotency_key: input.idempotencyKey };
    const put = async (row: Record<string, unknown>) => {
      const { data, error } = await s.from("email_notification_log").insert({ ...base, mode: "test", ...row }).select("id").single();
      if (error) { if (error.code === "23505") return null; throw error; }
      return data.id as string;
    };
    const enabled = event.integration === "integrated" && (await s.from("notification_rules").select("enabled").eq("event_key", "article_comment_confirm").maybeSingle()).data?.enabled !== false;
    if (!enabled) {
      const id = await put({ status: "skipped", reason: "notification_disabled", recipient: null });
      return id ? { status: "skipped" as const, id } : { status: "duplicate" as const };
    }
    if (!EMAIL.test(input.to)) {
      const id = await put({ status: "skipped", reason: "recipient_not_configured", recipient: null });
      return id ? { status: "skipped" as const, id } : { status: "duplicate" as const };
    }
    const def = DEFAULT_TEMPLATES["article_comment_confirm"];
    if (!def) return { status: "failed" as const, reason: "template_not_found" };
    const { data: custom } = await s.from("email_templates").select("subject, html, text_body").eq("key", "article_comment_confirm").maybeSingle();
    const tpl = { key: "article_comment_confirm", required: def.required, subject: custom?.subject ?? def.subject, html: custom?.html ?? def.html, text: custom?.text_body ?? def.text };
    const vars: Vars = { ...input.vars, nazwa_platformy: platform };
    const rendered = render(tpl, vars, tpl.required);
    if (!rendered.ok) {
      const id = await put({ status: "failed", reason: "missing_variables:" + rendered.missing.join(","), recipient: input.to, payload: stripSensitive(input.vars), retryable: true });
      return id ? { status: "failed" as const, id, reason: "missing_variables" } : { status: "duplicate" as const };
    }
    const id = await put({ status: "sending", recipient: input.to, payload: stripSensitive(input.vars), retryable: !rendered.usesSensitive });
    if (!id) return { status: "duplicate" as const };
    const safe = render(tpl, maskSensitive(vars), tpl.required);
    await s.from("email_notification_log").update({ status: "simulated", reason: null, attempts: 1, mode: "test", updated_at: new Date().toISOString(), rendered_subject: safe.ok ? safe.subject : null, rendered_html: safe.ok ? safe.html : null, rendered_text: safe.ok ? safe.text : null }).eq("id", id);
    return { status: "simulated" as const, id };
  } catch (error) {
    console.error("guest comment notification failed", error instanceof Error ? error.message : error);
    return { status: "failed" as const, reason: "internal_error" };
  }
}
async function sendLink(s: Db, c: { id: string; first: string; email: string; title: string; send: number }) {
  const token = newToken();
  const expires = new Date(Date.now() + TTL_HOURS * 3600_000).toISOString();
  const { error } = await s.from("article_comment_guests").update({ token_hash: await sha256(token), token_expires_at: expires, token_used_at: null }).eq("comment_id", c.id);
  if (error) throw new HttpError(500, "Nie udało się przygotować linku potwierdzającego.");
  const origin = (Deno.env.get("PUBLIC_SITE_URL") || "https://tatanabacznosci.pl").replace(/\/+$/, "");
  await dispatchConfirmation(s, {
    to: c.email, relatedId: c.id, idempotencyKey: "article-comment-" + c.id + "-" + c.send,
    vars: { imie: c.first, tytul_artykulu: c.title, waznosc_linku: TTL_HOURS + " godzin", link_do_potwierdzenia: origin + "/komentarz/potwierdz?t=" + token }
  });
}
const guestInput = z.object({
  articleId: z.string().uuid(),
  firstName: z.string().trim().min(1, "Podaj imię.").max(60).regex(/^[\p{L}][\p{L}\s'.-]*$/u, "Imię zawiera niedozwolone znaki."),
  lastName: z.string().trim().min(1, "Podaj nazwisko.").max(80).regex(/^[\p{L}][\p{L}\s'.-]*$/u, "Nazwisko zawiera niedozwolone znaki."),
  email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
  body: z.string().trim().min(2, "Komentarz jest za krótki.").max(2000, "Komentarz jest za długi."),
  rules: z.literal(true, { errorMap: () => ({ message: "Zaakceptuj zasady komentowania." }) }),
  website: z.string().max(0).optional().default(""),
  elapsedMs: z.number().int().nonnegative()
});
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submitGuestComment"), data: guestInput }),
  z.object({ action: z.literal("confirmGuestComment"), data: z.object({ token: z.string().min(20).max(100) }) }),
  z.object({ action: z.literal("resendGuestComment"), data: z.object({ token: z.string().min(20).max(100) }) })
]);
async function handle(s: Db, req: Request, raw: unknown) {
  const input = RequestSchema.parse(raw);
  switch (input.action) {
    case "submitGuestComment": {
      const data = input.data, neutral = { status: "check_email" as const };
      if (data.website || data.elapsedMs < 3000) return neutral;
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const ipHash = await hashIp(ip);
      const { data: article } = await s.from("articles").select("id, title, status, published_at").eq("id", data.articleId).maybeSingle();
      if (!article || article.status !== "published" || !article.published_at || new Date(article.published_at) > new Date()) throw new HttpError(400, "Ten artykuł nie przyjmuje komentarzy.");
      const since = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
      if (ipHash) {
        const [{ count: lastMin }, { count: lastHour }] = await Promise.all([
          s.from("article_comment_guests").select("comment_id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since(1)),
          s.from("article_comment_guests").select("comment_id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since(60))
        ]);
        if ((lastMin ?? 0) >= 1 || (lastHour ?? 0) >= 5) throw new HttpError(429, "Wysłano zbyt wiele komentarzy. Spróbuj ponownie później.");
      }
      const { count: perEmail } = await s.from("article_comment_guests").select("comment_id", { count: "exact", head: true }).eq("email", data.email).gte("created_at", since(60));
      if ((perEmail ?? 0) >= 5) return neutral;
      const author = (data.firstName + " " + data.lastName).replace(/\s+/g, " ");
      const { data: row, error } = await s.from("article_comments").insert({ article_id: article.id, body: data.body, author_name: author }).select("id").single();
      if (error || !row) throw new HttpError(500, "Nie udało się zapisać komentarza. Spróbuj ponownie.");
      const { error: guestError } = await s.from("article_comment_guests").insert({ comment_id: row.id, first_name: data.firstName, last_name: data.lastName, email: data.email, ip_hash: ipHash });
      if (guestError) {
        await s.from("article_comments").delete().eq("id", row.id);
        throw new HttpError(500, "Nie udało się zapisać komentarza. Spróbuj ponownie.");
      }
      await sendLink(s, { id: row.id, first: data.firstName, email: data.email, title: article.title, send: 1 });
      await logEvent(s, { type: "article_comment_guest_submitted", objectKind: "article_comment", objectId: row.id });
      return neutral;
    }
    case "confirmGuestComment": {
      const { data: guest } = await s.from("article_comment_guests").select("comment_id, token_expires_at, token_used_at, sends").eq("token_hash", await sha256(input.data.token)).maybeSingle();
      if (!guest) return { status: "invalid" as const };
      const { data: comment } = await s.from("article_comments").select("id, status, articles(slug)").eq("id", guest.comment_id).maybeSingle();
      const relation = comment?.articles as { slug: string } | { slug: string }[] | null | undefined;
      const slug = Array.isArray(relation) ? relation[0]?.slug : relation?.slug;
      if (!comment) return { status: "invalid" as const };
      if (guest.token_used_at) return { status: "used" as const, slug };
      if (!["pending_email", "expired"].includes(comment.status)) {
        await logEvent(s, { type: "article_comment_confirm_blocked", objectKind: "article_comment", objectId: comment.id, result: "denied" });
        return { status: "blocked" as const, slug };
      }
      if (!guest.token_expires_at || new Date(guest.token_expires_at) < new Date()) {
        await s.from("article_comments").update({ status: "expired" }).eq("id", comment.id);
        await logEvent(s, { type: "article_comment_confirm_expired", objectKind: "article_comment", objectId: comment.id, result: "failed" });
        return { status: "expired" as const, slug, canResend: guest.sends < MAX_SENDS };
      }
      const now = new Date().toISOString();
      const { data: used } = await s.from("article_comment_guests").update({ token_used_at: now, confirmed_at: now }).eq("comment_id", comment.id).is("token_used_at", null).select("comment_id");
      if (!used?.length) return { status: "used" as const, slug };
      const { error: confirmError } = await s.from("article_comments").update({ status: "confirmed" }).eq("id", comment.id).in("status", ["pending_email", "expired"]);
      if (confirmError) throw new HttpError(500, "Nie udało się potwierdzić komentarza.");
      const { error: publishError } = await s.from("article_comments").update({ status: "visible" }).eq("id", comment.id).eq("status", "confirmed");
      if (publishError) throw new HttpError(500, "Nie udało się opublikować komentarza.");
      await logEvent(s, { type: "article_comment_confirmed", objectKind: "article_comment", objectId: comment.id });
      return { status: "published" as const, slug };
    }
    case "resendGuestComment": {
      const neutral = { status: "sent_if_possible" as const };
      const { data: guest } = await s.from("article_comment_guests").select("comment_id, first_name, email, token_used_at, sends, last_sent_at").eq("token_hash", await sha256(input.data.token)).maybeSingle();
      if (!guest || guest.token_used_at || guest.sends >= MAX_SENDS || Date.now() - new Date(guest.last_sent_at).getTime() < 10 * 60_000) return neutral;
      const { data: comment } = await s.from("article_comments").select("id, status, articles(title)").eq("id", guest.comment_id).maybeSingle();
      if (!comment || !["pending_email", "expired"].includes(comment.status)) return neutral;
      const relation = comment.articles as { title: string } | { title: string }[] | null;
      const title = Array.isArray(relation) ? relation[0]?.title ?? "" : relation?.title ?? "";
      const send = guest.sends + 1;
      const now = new Date().toISOString();
      const { data: updated } = await s.from("article_comment_guests").update({ sends: send, last_sent_at: now }).eq("comment_id", comment.id).eq("sends", guest.sends).is("token_used_at", null).select("comment_id");
      if (!updated?.length) return neutral;
      await s.from("article_comments").update({ status: "pending_email" }).eq("id", comment.id);
      await sendLink(s, { id: comment.id, first: guest.first_name, email: guest.email, title, send });
      await logEvent(s, { type: "article_comment_confirm_resent", objectKind: "article_comment", objectId: comment.id });
      return neutral;
    }
  }
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
    if (status >= 500) console.error("tnb-guest-comments:", message);
    return json({ message }, status);
  }
});
