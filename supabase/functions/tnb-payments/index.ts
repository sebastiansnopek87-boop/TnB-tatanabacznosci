import { createClient } from "@supabase/supabase-js";
import { corsHeaders as sdkCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "zod";
import { ADAPTERS, REQUIREMENTS, configStatus, type ProviderId, type ProviderRow, type Notice } from "./providers.ts";
import { providerReferenceMatches } from "../_shared/payment-webhook.ts";
import { DEFAULT_TEMPLATES, EVENT_MAP } from "./registry.ts";
import { render, maskSensitive, stripSensitive, type Vars } from "./render.ts";

const CORS = new Headers({
  ...sdkCorsHeaders,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
  "X-Content-Type-Options": "nosniff",
});
const PROVIDER_LABEL: Record<ProviderId, string> = { p24: "Przelewy24", tpay: "Tpay", payu: "PayU" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Fail closed: operator tests and activation stay unavailable until the production SPA rollout.
const PAYMENT_OPERATIONS_ENABLED = Deno.env.get("TNB_PAYMENTS_OPERATIONS_ENABLED") === "true";

function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed.default === "string") return parsed.default;
    } catch { return raw; }
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
  if (!url || !key) throw new Error("Backend płatności nie jest skonfigurowany.");
  return createClient(url, key, { global: { fetch: createSupabaseFetch(key) }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
type Db = ReturnType<typeof adminClient>;
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: CORS }); }
function siteOrigin() { return (Deno.env.get("PUBLIC_SITE_URL") || "https://tatanabacznosci.pl").replace(/\/+$/, ""); }
async function logEvent(db: Db, event: { type: string; actor?: string | null; objectKind?: string | null; objectId?: string | null; result?: "ok" | "failed" | "denied"; detail?: string | null }) {
  try { await db.from("admin_events").insert({ type: event.type, actor: event.actor ?? null, object_kind: event.objectKind ?? null, object_id: event.objectId ?? null, result: event.result ?? "ok", detail: event.detail?.slice(0, 300) ?? null }); }
  catch (error) { console.error("payment admin event log failed", error); }
}
async function requireRole(db: Db, req: Request, superadmin = false) {
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const user = data.user;
  const { data: admin, error: adminError } = await db.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (adminError || !admin) { await logEvent(db, { type: "access_denied", actor: user.id, result: "denied" }); throw new HttpError(403, "Brak uprawnień administratora."); }
  if (superadmin) {
    const { data: allowed, error: roleError } = await db.rpc("has_role", { _user_id: user.id, _role: "superadmin" });
    if (roleError || !allowed) { await logEvent(db, { type: "access_denied", actor: user.id, objectKind: "payment", result: "denied", detail: "Wymagana rola superadministratora" }); throw new HttpError(403, "Tę zmianę może wykonać tylko superadministrator."); }
  }
  return user;
}
async function logOrderEvent(db: Db, orderId: string, type: string, detail?: string | null) {
  await db.from("library_order_events").insert({ order_id: orderId, type, detail: detail?.slice(0, 500) ?? null });
}
async function loadProvider(db: Db, id: ProviderId): Promise<ProviderRow | null> {
  const { data, error } = await db.from("payment_providers").select("id, enabled, is_default, environment, merchant_id, pos_id, client_id").eq("id", id).maybeSingle();
  return error ? null : data as ProviderRow | null;
}
async function notificationContext(db: Db) {
  const [{ data: settings }, { data: platform }] = await Promise.all([
    db.from("email_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("platform_settings").select("platform_name").eq("id", 1).maybeSingle(),
  ]);
  return { settings, platform: platform?.platform_name || "Tata Na Baczności" };
}
async function notificationEnabled(db: Db, event: string, settings: Record<string, unknown> | null) {
  const def = EVENT_MAP[event];
  if (!def || def.integration !== "integrated") return false;
  const legacy: Record<string, string> = { contact_message: "contact_notifications_enabled", newsletter_signup: "newsletter_notifications_enabled" };
  if (legacy[event]) return !!settings?.[legacy[event]];
  const { data } = await db.from("notification_rules").select("enabled").eq("event_key", event).maybeSingle();
  return data?.enabled ?? true;
}
async function dispatchOrderNotification(db: Db, orderId: string, event: string, suffix?: string) {
  try {
    const { data: order } = await db.from("library_orders").select("id, order_number, buyer_email, buyer_name, amount, access_token, user_id, library_items(title)").eq("id", orderId).maybeSingle();
    if (!order) return { status: "skipped" as const, reason: "order_not_found" };
    const { settings, platform } = await notificationContext(db);
    if (!(await notificationEnabled(db, event, settings))) return { status: "skipped" as const, reason: "notification_disabled" };
    const recipient = event === "order_admin_new" ? settings?.notification_recipient : order.buyer_email;
    if (typeof recipient !== "string" || !/^[^\s@<>"]+@[^\s@<>]+\.[a-z]{2,}$/i.test(recipient)) return { status: "skipped" as const, reason: "recipient_not_configured" };
    const template = DEFAULT_TEMPLATES[event];
    if (!template) return { status: "failed" as const, reason: "template_not_found" };
    const relatedItem = order.library_items as unknown as { title: string } | null;
    const origin = siteOrigin();
    const vars: Vars = {
      imie: (order.buyer_name ?? "").trim().split(/\s+/)[0] || "Kliencie",
      email: order.buyer_email,
      numer_zamowienia: order.order_number,
      kwota: (order.amount / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł",
      tytul_materialu: relatedItem?.title ?? "Materiał",
      link_do_materialu: origin + "/zakup/" + order.access_token,
      link_do_logowania: origin + "/auth",
      link_do_panelu: origin + "/admin/zamowienia",
      nazwa_platformy: platform,
    };
    const rendered = render(template, vars, template.required);
    if (!rendered.ok) return { status: "failed" as const, reason: "missing_variables" };
    const idempotencyKey = event + "-" + order.id + (suffix ? "-" + suffix : "");
    const { data: inserted, error } = await db.from("email_notification_log").insert({
      kind: event, related_id: order.id, template_key: event, idempotency_key: idempotencyKey,
      mode: "test", recipient, payload: stripSensitive(vars), retryable: !rendered.usesSensitive, status: "sending",
    }).select("id").single();
    if (error) {
      if (error.code === "23505") return { status: "duplicate" as const };
      console.error("order notification log insert failed", error.message);
      return { status: "failed" as const, reason: "log_insert_failed" };
    }
    const safe = render(template, maskSensitive(vars), template.required);
    await db.from("email_notification_log").update({
      status: "simulated", mode: "test", attempts: 1, reason: null, updated_at: new Date().toISOString(),
      rendered_subject: safe.ok ? safe.subject : null, rendered_html: safe.ok ? safe.html : null, rendered_text: safe.ok ? safe.text : null,
    }).eq("id", inserted.id);
    return { status: "simulated" as const, id: inserted.id };
  } catch (error) {
    console.error("order notification failed", error instanceof Error ? error.message : error);
    return { status: "failed" as const, reason: "internal_error" };
  }
}
async function afterPaid(db: Db, orderId: string) {
  const { data: order } = await db.from("library_orders").select("user_id").eq("id", orderId).maybeSingle();
  await dispatchOrderNotification(db, orderId, "order_paid");
  const sent = await dispatchOrderNotification(db, orderId, order?.user_id ? "order_access_delivered" : "order_guest_access");
  await db.from("library_orders").update({
    delivery_status: sent.status === "sent" ? "sent" : "not_sent",
    delivery_error: sent.status === "sent" ? null : sent.status === "simulated" ? "simulated" : sent.reason ?? sent.status,
  }).eq("id", orderId);
  await logOrderEvent(db, orderId, "access_granted", "Dostęp do materiału przyznany automatycznie po potwierdzeniu płatności.");
}
async function flagReview(db: Db, orderId: string, reason: string) {
  await db.from("library_orders").update({ status: "needs_review", review_reason: reason, status_changed_at: new Date().toISOString() }).eq("id", orderId).in("status", ["pending", "failed"]);
  await logOrderEvent(db, orderId, "needs_review", reason);
}
async function confirmOperatorPayment(db: Db, provider: ProviderRow, notice: Notice): Promise<{ result: string }> {
  let query = db.from("library_orders").select("id, status, amount, currency, provider, provider_ref, environment");
  query = notice.orderId && UUID.test(notice.orderId) ? query.eq("id", notice.orderId) : query.eq("provider", provider.id).eq("provider_ref", notice.providerRef);
  const { data: order } = await query.maybeSingle();
  if (!order) return { result: "order_not_found" };
  if (order.provider !== provider.id) { await flagReview(db, order.id, "Powiadomienie od " + provider.id + ", a zamówienie przypisane do " + order.provider + "."); return { result: "provider_mismatch" }; }
  if (order.environment !== provider.environment) {
    await logOrderEvent(db, order.id, "webhook_rejected", "Powiadomienie ze środowiska " + provider.environment + ", zamówienie ze środowiska " + order.environment + ".");
    return { result: "env_mismatch" };
  }
  // The local order UUID locates the order; the operator transaction reference
  // must independently match the reference persisted during checkout creation.
  if (!order.provider_ref) {
    await logOrderEvent(db, order.id, "webhook_retry", "Referencja transakcji nie została jeszcze zapisana.");
    return { result: "provider_ref_pending" };
  }
  if (!providerReferenceMatches(order.provider_ref, notice.providerRef)) {
    const reason = "Referencja transakcji operatora nie zgadza się z zapisanym zamówieniem.";
    if (["pending", "failed"].includes(order.status)) await flagReview(db, order.id, reason);
    else await logOrderEvent(db, order.id, "webhook_rejected", reason);
    return { result: "provider_ref_mismatch" };
  }
  if (notice.outcome === "pending") {
    await logOrderEvent(db, order.id, "webhook_pending", "Operator: płatność w toku (" + notice.eventId + ").");
    return { result: "pending" };
  }
  if (notice.outcome === "failed") {
    const now = new Date().toISOString();
    const { data } = await db.from("library_orders").update({ status: "failed", failed_at: now, status_changed_at: now }).eq("id", order.id).eq("status", "pending").select("id");
    if (!data?.length) { await logOrderEvent(db, order.id, "duplicate_ignored", "Powiadomienie o nieudanej płatności przy statusie " + order.status + " — pominięto."); return { result: "ignored" }; }
    await logOrderEvent(db, order.id, "failed", "Operator zgłosił nieudaną płatność. Dostęp nie został przyznany.");
    await dispatchOrderNotification(db, order.id, "order_payment_failed");
    return { result: "failed" };
  }
  if (notice.amount !== order.amount || notice.currency.toUpperCase() !== order.currency.toUpperCase()) {
    await flagReview(db, order.id, "Niezgodna kwota lub waluta: operator " + notice.amount + " " + notice.currency + ", zamówienie " + order.amount + " " + order.currency + ".");
    return { result: "amount_mismatch" };
  }
  const now = new Date().toISOString();
  const { data } = await db.from("library_orders").update({ status: "paid", paid_at: now, status_changed_at: now, provider_ref: order.provider_ref ?? notice.providerRef, access_expires_at: null })
    .eq("id", order.id).in("status", ["pending", "failed"]).select("id");
  if (!data?.length) { await logOrderEvent(db, order.id, "duplicate_ignored", "Powtórzone potwierdzenie (" + notice.eventId + ") przy statusie " + order.status + " — pominięto."); return { result: "duplicate" }; }
  await logOrderEvent(db, order.id, "paid", "Płatność potwierdzona przez operatora " + provider.id + " (zweryfikowany podpis).");
  await afterPaid(db, order.id);
  return { result: "paid" };
}
async function handleWebhook(db: Db, id: ProviderId, request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > 20000) return new Response("Too large", { status: 413 });
  const provider = await loadProvider(db, id);
  if (!provider || !configStatus(provider).configured) return new Response("Not configured", { status: 503 });
  let notice: Notice | null = null;
  try { notice = await ADAPTERS[id].notice(provider, raw, request.headers); } catch (error) { console.error("payment webhook parse", id, error); }
  if (!notice) {
    await logEvent(db, { type: "payment_webhook_invalid", objectKind: "payment", objectId: id, result: "denied", detail: "Nieprawidłowy podpis lub dane powiadomienia." });
    return new Response("Invalid signature", { status: 401 });
  }
  const { error: duplicateError } = await db.from("payment_webhook_events").insert({ event_id: notice.eventId, environment: provider.environment, type: id + ":" + notice.outcome });
  if (duplicateError?.code === "23505") return ADAPTERS[id].ack();
  if (duplicateError) return new Response("Retry", { status: 500 });
  try {
    const result = await confirmOperatorPayment(db, provider, notice);
    if (result.result === "provider_ref_pending") {
      await db.from("payment_webhook_events").delete().eq("event_id", notice.eventId);
      return new Response("Retry", { status: 500 });
    }
    await logEvent(db, { type: "payment_webhook", objectKind: "payment", objectId: notice.orderId ?? notice.providerRef, result: ["paid", "failed", "pending", "duplicate", "ignored"].includes(result.result) ? "ok" : "failed", detail: id + ": " + result.result });
    return ADAPTERS[id].ack();
  } catch (error) {
    console.error("payment webhook processing", id, error);
    await db.from("payment_webhook_events").delete().eq("event_id", notice.eventId);
    return new Response("Retry", { status: 500 });
  }
}

const providerId = z.enum(["p24", "tpay", "payu"]);
const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("listPaymentProviders") }),
  z.object({ action: z.literal("updatePaymentProvider"), data: z.object({
    id: providerId, enabled: z.boolean(), isDefault: z.boolean(),
    merchant_id: z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/),
    pos_id: z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/),
    client_id: z.string().trim().max(120).regex(/^[A-Za-z0-9_.-]*$/),
  }) }),
  z.object({ action: z.literal("setPaymentEnvironment"), data: z.object({ id: providerId, environment: z.enum(["sandbox", "live"]), confirm: z.string().max(40).default("") }) }),
  z.object({ action: z.literal("testPaymentProvider"), data: z.object({ id: providerId }) }),
]);
async function listProviders(db: Db, userId: string) {
  const [{ data }, { data: superRole }] = await Promise.all([
    db.from("payment_providers").select("*").order("id"),
    db.rpc("has_role", { _user_id: userId, _role: "superadmin" }),
  ]);
  const baseUrl = Deno.env.get("SUPABASE_URL") || "";
  const rows = (data ?? []) as ProviderRow[];
  return { canEdit: !!superRole, providers: rows.map((row) => {
    const meta = REQUIREMENTS[row.id as ProviderId];
    return { ...row, label: meta.label, fields: meta.fields, docs: meta.docs, refunds: meta.refunds,
      webhookUrl: baseUrl + "/functions/v1/tnb-payments?provider=" + row.id, status: configStatus(row) };
  }) };
}
type UpdateProviderInput = Extract<z.infer<typeof actions>, { action: "updatePaymentProvider" }>["data"];
type SetEnvironmentInput = Extract<z.infer<typeof actions>, { action: "setPaymentEnvironment" }>["data"];
async function updateProvider(db: Db, userId: string, data: UpdateProviderInput) {
  const { data: current } = await db.from("payment_providers").select("*").eq("id", data.id).maybeSingle();
  if (!current) throw new HttpError(404, "Nie znaleziono operatora płatności.");
  const next = { ...current, merchant_id: data.merchant_id || null, pos_id: data.pos_id || null, client_id: data.client_id || null } as ProviderRow;
  if (!PAYMENT_OPERATIONS_ENABLED && (data.enabled || data.isDefault)) {
    throw new HttpError(409, "Aktywacja operatorów zostanie odblokowana po wdrożeniu React SPA na produkcję.");
  }
  if (data.enabled && !configStatus(next).configured) throw new HttpError(400, "Nie można włączyć operatora bez kompletnej konfiguracji.");
  if (data.isDefault && !data.enabled) throw new HttpError(400, "Operator domyślny musi być włączony.");
  let liveTest: { ok: boolean; detail: string } | null = null;
  if (data.enabled && current.environment === "live") {
    liveTest = await ADAPTERS[data.id as ProviderId].test(next).catch(() => ({ ok: false, detail: "Brak odpowiedzi od operatora." }));
    if (!liveTest.ok) throw new HttpError(400, "Nie można włączyć operatora w trybie produkcyjnym: " + liveTest.detail);
  }
  const idsChanged = next.merchant_id !== current.merchant_id || next.pos_id !== current.pos_id || next.client_id !== current.client_id;
  const testFields = liveTest ? { last_test_at: new Date().toISOString(), last_test_ok: liveTest.ok, last_test_detail: liveTest.detail }
    : idsChanged ? { last_test_at: null, last_test_ok: null, last_test_detail: null } : {};
  if (data.isDefault) await db.from("payment_providers").update({ is_default: false }).neq("id", data.id);
  const { error } = await db.from("payment_providers").update({
    enabled: data.enabled, is_default: data.isDefault, merchant_id: next.merchant_id, pos_id: next.pos_id, client_id: next.client_id,
    ...testFields, updated_at: new Date().toISOString(), updated_by: userId,
  }).eq("id", data.id);
  if (error) throw new HttpError(500, "Nie udało się zapisać konfiguracji.");
  await logEvent(db, { type: "payment_config", actor: userId, objectKind: "payment", objectId: data.id, detail: (data.enabled ? "włączony" : "wyłączony") + (data.isDefault ? ", domyślny" : "") });
  return { ok: true };
}
async function setEnvironment(db: Db, userId: string, data: SetEnvironmentInput) {
  if (data.environment === "live" && !PAYMENT_OPERATIONS_ENABLED) {
    throw new HttpError(409, "Środowisko produkcyjne operatora będzie dostępne po wdrożeniu React SPA.");
  }
  if (data.environment === "live" && data.confirm !== "URUCHAMIAM PRODUKCJĘ") throw new HttpError(400, "Aby włączyć środowisko produkcyjne, wpisz: URUCHAMIAM PRODUKCJĘ");
  if (data.environment === "live") {
    const { data: current } = await db.from("payment_providers").select("*").eq("id", data.id).maybeSingle();
    if (!current || !configStatus(current).configured) throw new HttpError(400, "Nie można uruchomić produkcji bez kompletnej konfiguracji.");
    if (!current.last_test_ok) throw new HttpError(400, "Najpierw wykonaj udany test połączenia.");
  }
  const liveReset = data.environment === "live" ? { enabled: false, is_default: false } : {};
  const { error } = await db.from("payment_providers").update({
    environment: data.environment, ...liveReset, last_test_at: null, last_test_ok: null, last_test_detail: null,
    updated_at: new Date().toISOString(), updated_by: userId,
  }).eq("id", data.id);
  if (error) throw new HttpError(500, "Nie udało się zmienić środowiska.");
  await logEvent(db, { type: data.environment === "live" ? "payment_live_on" : "payment_live_off", actor: userId, objectKind: "payment", objectId: data.id });
  return { ok: true };
}
async function testProvider(db: Db, userId: string, id: ProviderId) {
  if (!PAYMENT_OPERATIONS_ENABLED) {
    return { ok: false, detail: "Testy połączeń z operatorami zostaną uruchomione po wdrożeniu React SPA na produkcję." };
  }
  const { data: provider } = await db.from("payment_providers").select("*").eq("id", id).maybeSingle();
  if (!provider) throw new HttpError(404, "Nie znaleziono operatora płatności.");
  const status = configStatus(provider);
  const result = !status.configured ? { ok: false, detail: "Brak danych: " + status.missing.join(", ") + "." }
    : await ADAPTERS[id].test(provider as ProviderRow).catch(() => ({ ok: false, detail: "Brak odpowiedzi od operatora." }));
  const { error } = await db.from("payment_providers").update({ last_test_at: new Date().toISOString(), last_test_ok: result.ok, last_test_detail: result.detail }).eq("id", id);
  if (error) throw new HttpError(500, "Nie udało się zapisać wyniku testu.");
  await logEvent(db, { type: "payment_test", actor: userId, objectKind: "payment", objectId: id, result: result.ok ? "ok" : "failed", detail: result.detail });
  return result;
}
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const rawProvider = url.searchParams.get("provider");
  if (rawProvider) {
    if (req.method !== "POST" || !["p24", "tpay", "payu"].includes(rawProvider)) return new Response("Not found", { status: 404 });
    try { return await handleWebhook(adminClient(), rawProvider as ProviderId, req); }
    catch (error) { console.error("payment webhook fatal", error); return new Response("Retry", { status: 500 }); }
  }
  if (req.method !== "POST") return json({ message: "Niedozwolona metoda." }, 405);
  try {
    const db = adminClient();
    const parsed = actions.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ message: "Nieprawidłowe żądanie." }, 400);
    const input = parsed.data;
    const superOnly = input.action === "updatePaymentProvider" || input.action === "setPaymentEnvironment";
    const user = await requireRole(db, req, superOnly);
    switch (input.action) {
      case "listPaymentProviders": return json(await listProviders(db, user.id));
      case "updatePaymentProvider": return json(await updateProvider(db, user.id, input.data));
      case "setPaymentEnvironment": return json(await setEnvironment(db, user.id, input.data));
      case "testPaymentProvider": return json(await testProvider(db, user.id, input.data.id));
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Wystąpił błąd serwera.";
    if (status >= 500) console.error("tnb-payments error:", message);
    return json({ message }, status);
  }
  return json({ message: "Nieznana operacja." }, 400);
});
