import { createClient } from "@supabase/supabase-js";
import { corsHeaders as sdkCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "zod";
import { DEFAULT_TEMPLATES, EVENTS, EVENT_MAP, sampleVars } from "./registry.ts";
import { render, maskSensitive, stripSensitive, type Vars } from "./render.ts";

const CORS = new Headers({
  ...sdkCorsHeaders,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
  "X-Content-Type-Options": "nosniff",
});
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
const LEGACY_TOGGLE: Record<string, "contact_notifications_enabled" | "newsletter_notifications_enabled"> = {
  contact_message: "contact_notifications_enabled",
  newsletter_signup: "newsletter_notifications_enabled",
};

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
    if ((apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + apiKey) headers.delete("Authorization");
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}
function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Backend powiadomień nie jest skonfigurowany.");
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
async function logEvent(db: Db, event: { type: string; actor?: string | null; objectKind?: string | null; objectId?: string | null; result?: "ok" | "failed" | "denied"; detail?: string | null }) {
  try {
    await db.from("admin_events").insert({
      type: event.type, actor: event.actor ?? null, object_kind: event.objectKind ?? null,
      object_id: event.objectId ?? null, result: event.result ?? "ok", detail: event.detail?.slice(0, 300) ?? null,
    });
  } catch (error) { console.error("notification event log failed", error); }
}
async function requireRole(db: Db, req: Request, superadmin = false) {
  const match = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const { data, error } = await db.auth.getUser(match[1]);
  if (error || !data.user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const user = data.user;
  const { data: admin, error: adminError } = await db.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (adminError || !admin) {
    await logEvent(db, { type: "access_denied", actor: user.id, result: "denied" });
    throw new HttpError(403, "Brak uprawnień administratora.");
  }
  if (superadmin) {
    const { data: allowed, error: roleError } = await db.rpc("has_role", { _user_id: user.id, _role: "superadmin" });
    if (roleError || !allowed) {
      await logEvent(db, { type: "access_denied", actor: user.id, objectKind: "settings", objectId: "notifications", result: "denied", detail: "Wymagana rola superadministratora" });
      throw new HttpError(403, "Tę zmianę może wykonać tylko superadministrator.");
    }
  }
  return user;
}
async function eventEnabled(db: Db, key: string, settings: Record<string, unknown> | null) {
  const event = EVENT_MAP[key];
  if (!event) return false;
  if (key === "test_message") return true;
  if (event.integration !== "integrated") return false;
  const legacy = LEGACY_TOGGLE[key];
  if (legacy) return !!settings?.[legacy];
  const { data } = await db.from("notification_rules").select("enabled").eq("event_key", key).maybeSingle();
  return data?.enabled ?? true;
}
async function context(db: Db) {
  const [{ data: settings }, { data: platformRow }] = await Promise.all([
    db.from("email_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("platform_settings").select("platform_name").eq("id", 1).maybeSingle(),
  ]);
  return { settings, platform: platformRow?.platform_name || "Tata Na Baczności" };
}
async function loadTemplate(db: Db, key: string) {
  const def = DEFAULT_TEMPLATES[key];
  if (!def) return null;
  const { data } = await db.from("email_templates").select("subject, html, text_body").eq("key", key).maybeSingle();
  return { key, required: def.required, subject: data?.subject ?? def.subject, html: data?.html ?? def.html, text: data?.text_body ?? def.text, custom: !!data };
}
const tplSchema = z.object({
  key: z.string().max(64),
  subject: z.string().trim().min(1, "Podaj temat").max(200),
  html: z.string().min(1, "Podaj treść HTML").max(20000),
  text: z.string().min(1, "Podaj wersję tekstową").max(10000),
});
const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("getNotificationOverview") }),
  z.object({ action: z.literal("getTemplate"), data: z.object({ key: z.string().max(64) }) }),
  z.object({ action: z.literal("previewTemplate"), data: tplSchema.extend({ vars: z.record(z.string(), z.string().max(500)).optional() }) }),
  z.object({ action: z.literal("saveTemplate"), data: tplSchema }),
  z.object({ action: z.literal("resetTemplate"), data: z.object({ key: z.string().max(64) }) }),
  z.object({ action: z.literal("setEventEnabled"), data: z.object({ key: z.string().max(64), enabled: z.boolean() }) }),
  z.object({ action: z.literal("updateDeliveryConfig"), data: z.object({
    reply_to: z.union([z.string().trim().email("Podaj poprawny adres odpowiedzi").max(255), z.literal("")]).transform((v) => v || null),
    delivery_mode: z.enum(["test", "live"]),
  }) }),
  z.object({ action: z.literal("sendTestMessage"), data: z.object({ key: z.string().max(64), to: z.string().trim().email("Podaj poprawny adres e-mail").max(255), vars: z.record(z.string(), z.string().max(500)).optional() }) }),
  z.object({ action: z.literal("runDuplicateCheck") }),
  z.object({ action: z.literal("retryNotification"), data: z.object({ id: z.string().uuid() }) }),
  z.object({ action: z.literal("getLogPreview"), data: z.object({ id: z.string().uuid() }) }),
]);

type DispatchResult = { status: "sent" | "simulated" | "skipped" | "failed" | "duplicate"; id?: string; reason?: string };
async function dispatch(db: Db, input: { event: string; to?: string | null; vars: Vars; idempotencyKey: string; relatedId?: string | null; forceTest?: boolean; test?: boolean }): Promise<DispatchResult> {
  try {
    const event = EVENT_MAP[input.event];
    if (!event) return { status: "failed", reason: "unknown_event" };
    const { settings, platform } = await context(db);
    const base = { kind: input.event, related_id: input.relatedId ?? null, template_key: input.event, idempotency_key: input.idempotencyKey };
    const mode = "test"; // providerStatus() is deliberately disconnected until the real mail provider is configured.
    const insert = async (row: Record<string, unknown>) => {
      const { data, error } = await db.from("email_notification_log").insert({ ...base, mode, ...row }).select("id").single();
      if (error) { if (error.code === "23505") return null; throw error; }
      return data.id as string;
    };
    if (!input.test && !input.forceTest && !(await eventEnabled(db, input.event, settings))) {
      const id = await insert({ status: "skipped", reason: event.integration === "integrated" ? "notification_disabled" : "event_not_integrated", recipient: null });
      return id ? { status: "skipped", id, reason: "notification_disabled" } : { status: "duplicate" };
    }
    const to = (event.recipient === "admin" && !input.test ? settings?.notification_recipient : input.to)?.trim() ?? "";
    if (!EMAIL.test(to)) {
      const id = await insert({ status: "skipped", reason: "recipient_not_configured", recipient: to || null });
      return id ? { status: "skipped", id, reason: "recipient_not_configured" } : { status: "duplicate" };
    }
    const template = await loadTemplate(db, input.event);
    if (!template) return { status: "failed", reason: "template_not_found" };
    const vars: Vars = { ...input.vars, nazwa_platformy: platform };
    const payload = stripSensitive(input.vars);
    const rendered = render(template, vars, template.required);
    if (!rendered.ok) {
      const id = await insert({ status: "failed", reason: "missing_variables:" + rendered.missing.join(","), recipient: to, payload, retryable: true });
      return id ? { status: "failed", id, reason: "missing_variables" } : { status: "duplicate" };
    }
    const id = await insert({ status: "sending", recipient: to, payload, retryable: !rendered.usesSensitive });
    if (!id) return { status: "duplicate" };
    const safe = render(template, maskSensitive(vars), template.required);
    await db.from("email_notification_log").update({
      status: "simulated", reason: null, attempts: 1, mode: "test", updated_at: new Date().toISOString(),
      rendered_subject: safe.ok ? safe.subject : null,
      rendered_html: safe.ok ? safe.html : null,
      rendered_text: safe.ok ? safe.text : null,
    }).eq("id", id);
    return { status: "simulated", id };
  } catch (error) {
    console.error("notification dispatch failed", error instanceof Error ? error.message : error);
    return { status: "failed", reason: "internal_error" };
  }
}
async function overview(db: Db, userId: string) {
  const [{ data: settings }, { data: templates }, superResult] = await Promise.all([
    db.from("email_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("email_templates").select("key, updated_at"),
    db.rpc("has_role", { _user_id: userId, _role: "superadmin" }),
  ]);
  const custom = new Map((templates ?? []).map((row: { key: string; updated_at: string }) => [row.key, row.updated_at]));
  const events = await Promise.all(EVENTS.map(async (event) => ({ ...event, enabled: await eventEnabled(db, event.key, settings), customized: custom.has(event.key) })));
  return {
    canEdit: !!superResult.data,
    provider: { name: "Lovable — wbudowana poczta", connected: false, domainStatus: "pending" },
    settings: {
      sender: (settings?.sender_local_part ?? "kontakt") + "@" + (settings?.sender_domain ?? "—"),
      sender_name: settings?.sender_name ?? "",
      reply_to: settings?.reply_to ?? null,
      delivery_mode: "test" as const,
      recipient: settings?.notification_recipient ?? null,
    },
    events,
  };
}
async function retry(db: Db, id: string): Promise<DispatchResult> {
  const { data: row } = await db.from("email_notification_log").select("*").eq("id", id).maybeSingle();
  if (!row) throw new HttpError(404, "Nie znaleziono wpisu.");
  if (row.status !== "failed") throw new HttpError(409, "Ponowić można tylko wysyłkę zakończoną błędem.");
  if (!row.retryable || !row.template_key || !row.recipient) throw new HttpError(409, "Tej wysyłki nie można bezpiecznie ponowić (zawierała poufny link).");
  const { data: locked } = await db.from("email_notification_log").update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "failed").select("id");
  if (!locked?.length) throw new HttpError(409, "Wysyłka jest już ponawiana.");
  const { settings, platform } = await context(db);
  const template = await loadTemplate(db, row.template_key);
  if (!template) throw new HttpError(404, "Nie znaleziono szablonu.");
  const vars: Vars = { ...((row.payload as Record<string, string>) ?? {}), nazwa_platformy: platform };
  const rendered = render(template, vars, template.required);
  if (!rendered.ok) {
    await db.from("email_notification_log").update({ status: "failed", reason: "missing_variables:" + rendered.missing.join(","), attempts: (row.attempts ?? 0) + 1, updated_at: new Date().toISOString() }).eq("id", id);
    return { status: "failed", id, reason: "missing_variables" };
  }
  const safe = render(template, maskSensitive(vars), template.required);
  await db.from("email_notification_log").update({
    status: "simulated", reason: null, attempts: (row.attempts ?? 0) + 1, mode: "test", updated_at: new Date().toISOString(),
    rendered_subject: safe.ok ? safe.subject : null, rendered_html: safe.ok ? safe.html : null, rendered_text: safe.ok ? safe.text : null,
  }).eq("id", id);
  return { status: "simulated", id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ message: "Niedozwolona metoda." }, 405);
  try {
    const db = adminClient();
    const body = await req.json().catch(() => null);
    const parsed = actions.safeParse(body);
    if (!parsed.success) return json({ message: "Nieprawidłowe żądanie." }, 400);
    const input = parsed.data;
    const superOnly = new Set(["saveTemplate", "resetTemplate", "setEventEnabled", "updateDeliveryConfig", "sendTestMessage", "runDuplicateCheck", "retryNotification"]);
    const user = await requireRole(db, req, superOnly.has(input.action));
    switch (input.action) {
      case "getNotificationOverview": return json(await overview(db, user.id));
      case "getTemplate": {
        const template = await loadTemplate(db, input.data.key);
        if (!template) throw new HttpError(404, "Nie ma takiego szablonu.");
        return json(template);
      }
      case "previewTemplate": {
        const def = DEFAULT_TEMPLATES[input.data.key];
        if (!def) throw new HttpError(404, "Nie ma takiego szablonu.");
        return json(render(input.data, maskSensitive({ ...sampleVars(), ...(input.data.vars ?? {}) }), def.required));
      }
      case "saveTemplate": {
        const def = DEFAULT_TEMPLATES[input.data.key];
        if (!def) throw new HttpError(404, "Nie ma takiego szablonu.");
        const check = render(input.data, sampleVars(), def.required);
        if (!check.ok) throw new HttpError(400, "Szablon zawiera nieznane lub brakujące zmienne: " + check.missing.join(", "));
        const { error } = await db.from("email_templates").upsert({ key: input.data.key, subject: input.data.subject, html: input.data.html, text_body: input.data.text, updated_at: new Date().toISOString(), updated_by: user.id });
        if (error) throw new HttpError(500, "Nie udało się zapisać szablonu.");
        await logEvent(db, { type: "template_update", actor: user.id, objectKind: "template", objectId: input.data.key });
        return json({ ok: true });
      }
      case "resetTemplate": {
        if (!DEFAULT_TEMPLATES[input.data.key]) throw new HttpError(404, "Nie ma takiego szablonu.");
        const { error } = await db.from("email_templates").delete().eq("key", input.data.key);
        if (error) throw new HttpError(500, "Nie udało się przywrócić domyślnego szablonu.");
        await logEvent(db, { type: "template_reset", actor: user.id, objectKind: "template", objectId: input.data.key });
        return json({ ok: true });
      }
      case "setEventEnabled": {
        const event = EVENTS.find((item) => item.key === input.data.key);
        if (!event || event.integration !== "integrated" || event.key === "test_message") throw new HttpError(400, "To zdarzenie nie jest jeszcze zintegrowane — nie można go włączyć.");
        const legacy = LEGACY_TOGGLE[input.data.key];
        const result = legacy
          ? await db.from("email_settings").update({ [legacy]: input.data.enabled, updated_at: new Date().toISOString() }).eq("id", 1)
          : await db.from("notification_rules").upsert({ event_key: input.data.key, enabled: input.data.enabled, updated_at: new Date().toISOString(), updated_by: user.id });
        if (result.error) throw new HttpError(500, "Nie udało się zapisać reguły.");
        await logEvent(db, { type: input.data.enabled ? "rule_enabled" : "rule_disabled", actor: user.id, objectKind: "rule", objectId: input.data.key });
        return json({ ok: true });
      }
      case "updateDeliveryConfig": {
        if (input.data.delivery_mode === "live") throw new HttpError(409, "Rzeczywistej wysyłki nie można włączyć: dostawca poczty nie jest skonfigurowany i zweryfikowany.");
        const { error } = await db.from("email_settings").update({ ...input.data, updated_at: new Date().toISOString() }).eq("id", 1);
        if (error) throw new HttpError(500, "Nie udało się zapisać konfiguracji.");
        await logEvent(db, { type: "settings_update", actor: user.id, objectKind: "settings", objectId: "email_provider" });
        return json({ ok: true });
      }
      case "sendTestMessage": {
        if (!DEFAULT_TEMPLATES[input.data.key]) throw new HttpError(404, "Nie ma takiego szablonu.");
        const result = await dispatch(db, { event: input.data.key, to: input.data.to, vars: { ...sampleVars(), ...(input.data.vars ?? {}) }, idempotencyKey: "test-" + input.data.key + "-" + crypto.randomUUID(), test: true });
        await logEvent(db, { type: "email_test", actor: user.id, objectKind: "template", objectId: input.data.key, result: result.status === "failed" ? "failed" : "ok" });
        return json(result);
      }
      case "runDuplicateCheck": {
        const { data: me } = await db.auth.admin.getUserById(user.id);
        const inputData = { event: "test_message", to: me.user?.email ?? "", vars: { imie: "Test" }, idempotencyKey: "dup-check-" + crypto.randomUUID(), forceTest: true };
        const first = await dispatch(db, inputData);
        const second = await dispatch(db, inputData);
        return json({ first: first.status, second: second.status });
      }
      case "retryNotification": {
        const result = await retry(db, input.data.id);
        await logEvent(db, { type: "email_retry", actor: user.id, objectKind: "notification", objectId: input.data.id, result: result.status === "failed" ? "failed" : "ok" });
        return json(result);
      }
      case "getLogPreview": {
        const { data: row, error } = await db.from("email_notification_log").select("rendered_subject, rendered_html, rendered_text, mode").eq("id", input.data.id).maybeSingle();
        if (error || !row) throw new HttpError(404, "Nie znaleziono podglądu.");
        return json(row);
      }
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Wystąpił błąd serwera.";
    if (status >= 500) console.error("tnb-notifications error:", message);
    return json({ message }, status);
  }
  return json({ message: "Nieznana operacja." }, 400);
});
