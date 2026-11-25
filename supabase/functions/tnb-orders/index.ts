import { createClient } from "@supabase/supabase-js";
import { corsHeaders as sdkCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "zod";
import { ADAPTERS, configStatus, type ProviderId, type ProviderRow } from "./providers.ts";
import { DEFAULT_TEMPLATES, EVENT_MAP } from "./registry.ts";
import { render, maskSensitive, stripSensitive, type Vars } from "./render.ts";
import { checkoutFingerprint } from "../_shared/checkout-idempotency.ts";
import { getOutboxFinishDecision } from "../_shared/delivery-outbox.ts";
import { parseBearerToken } from "../_shared/cron-auth.ts";
import { sendSmtpMail, smtpConfig } from "../_shared/smtp.ts";

const CORS = new Headers({
  ...sdkCorsHeaders,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
  "X-Content-Type-Options": "nosniff",
});
const CONSENT = "Akceptuję Regulamin i Politykę prywatności. Wyrażam zgodę na przetwarzanie imienia, nazwiska, adresu e-mail i (opcjonalnie) numeru telefonu w celu realizacji zamówienia i dostarczenia materiału.";
const PROVIDERS = ["p24", "tpay", "payu"] as const;
const PROVIDER_LABEL: Record<string, string> = { p24: "Przelewy24", tpay: "Tpay", payu: "PayU" };
const ACCESS_STATUSES = ["paid", "refund_pending", "refunded"];
const STATUSES = ["pending", "paid", "failed", "cancelled", "refund_pending", "refunded", "needs_review"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!url || !key) throw new Error("Backend zamówień nie jest skonfigurowany.");
  return createClient(url, key, { global: { fetch: createSupabaseFetch(key) }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
type Db = ReturnType<typeof adminClient>;
type CheckoutProviderRow = {
  id: string; enabled: boolean; is_default: boolean; environment: string;
  merchant_id: string | null; pos_id: string | null; client_id: string | null;
};
type PurchaseRow = {
  id: string; paid_at: string | null; amount: number; access_token: string;
  library_items: { title: string; slug: string } | null;
};
type AdminOrderRow = {
  order_number: string; buyer_email: string; buyer_name: string | null;
  library_items: { title: string } | null;
};
type SalesRow = {
  environment: string; is_test: boolean; paid_at: string | null; status: string;
  amount: number; provider: string | null; created_at: string;
};
type AdminOrderFilters = {
  status: typeof STATUSES[number] | "all";
  provider: "all" | "manual" | typeof PROVIDERS[number];
  kind: "all" | "real" | "test"; from: string; to: string; q: string;
};
type AdminOrderAction = {
  id: string;
  action: "paid" | "delivered" | "cancelled" | "refund_start" | "refund_complete" | "review_paid" | "review_failed";
  reason: string; revokeAccess: boolean; confirmNumber: string;
};
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: CORS }); }
function siteOrigin() { return (Deno.env.get("PUBLIC_SITE_URL") || "https://tatanabacznosci.pl").replace(/\/+$/, ""); }
function hasAccess(order: { status: string; paid_at: string | null; access_revoked_at: string | null }) {
  return !!order.paid_at && !order.access_revoked_at && ACCESS_STATUSES.includes(order.status);
}
async function logEvent(db: Db, event: { type: string; actor?: string | null; objectKind?: string | null; objectId?: string | null; result?: "ok" | "failed" | "denied"; detail?: string | null }) {
  try {
    await db.from("admin_events").insert({
      type: event.type, actor: event.actor ?? null, object_kind: event.objectKind ?? null,
      object_id: event.objectId ?? null, result: event.result ?? "ok", detail: event.detail?.slice(0, 300) ?? null,
    });
  } catch (error) { console.error("order admin event log failed", error); }
}
async function logOrderEvent(db: Db, orderId: string, type: string, detail?: string | null) {
  await db.from("library_order_events").insert({ order_id: orderId, type, detail: detail?.slice(0, 500) ?? null });
}
async function getUser(db: Db, req: Request) {
  const token = parseBearerToken(req.headers.get("authorization")) ?? "";
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return !error && data.user ? data.user : null;
}
async function requireAdmin(db: Db, req: Request) {
  const user = await getUser(db, req);
  if (!user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const { data, error } = await db.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (error || !data) {
    await logEvent(db, { type: "access_denied", actor: user.id, result: "denied" });
    throw new HttpError(403, "Brak uprawnień administratora.");
  }
  return user;
}
async function requireSignedIn(db: Db, req: Request) {
  const user = await getUser(db, req);
  if (!user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  return user;
}
async function providerRow(db: Db, id: ProviderId): Promise<ProviderRow | null> {
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
    const smtp = smtpConfig();
    const mode = settings?.delivery_mode === "live" && smtp.configured ? "live" : "test";
    if (!(await notificationEnabled(db, event, settings))) return { status: "skipped" as const, reason: "notification_disabled" };
    const recipient = event === "order_admin_new" ? settings?.notification_recipient : order.buyer_email;
    if (typeof recipient !== "string" || !/^[^\s@<>"]+@[^\s@<>]+\.[a-z]{2,}$/i.test(recipient)) return { status: "skipped" as const, reason: "recipient_not_configured" };
    const template = DEFAULT_TEMPLATES[event];
    if (!template) return { status: "failed" as const, reason: "template_not_found" };
    const item = order.library_items as unknown as { title: string } | null;
    const origin = siteOrigin();
    const vars: Vars = {
      imie: (order.buyer_name ?? "").trim().split(/\s+/)[0] || "Kliencie",
      email: order.buyer_email,
      numer_zamowienia: order.order_number,
      kwota: (order.amount / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł",
      tytul_materialu: item?.title ?? "Materiał",
      link_do_materialu: origin + "/zakup/" + order.access_token,
      link_do_logowania: origin + "/auth",
      link_do_panelu: origin + "/admin/zamowienia",
      nazwa_platformy: platform,
    };
    const rendered = render(template, vars, template.required);
    if (!rendered.ok) return { status: "failed" as const, reason: "missing_variables" };
    const { data: inserted, error } = await db.from("email_notification_log").insert({
      kind: event, related_id: order.id, template_key: event,
      idempotency_key: event + "-" + order.id + (suffix ? "-" + suffix : ""),
      mode, recipient, payload: stripSensitive(vars), retryable: !rendered.usesSensitive, status: "sending",
    }).select("id").single();
    if (error) {
      if (error.code === "23505") return { status: "duplicate" as const };
      console.error("order notification log insert failed", error.message);
      return { status: "failed" as const, reason: "log_insert_failed" };
    }
    if (mode === "test") {
      const safe = render(template, maskSensitive(vars), template.required);
      await db.from("email_notification_log").update({
        status: "simulated", mode: "test", attempts: 1, reason: null, updated_at: new Date().toISOString(),
        rendered_subject: safe.ok ? safe.subject : null, rendered_html: safe.ok ? safe.html : null, rendered_text: safe.ok ? safe.text : null,
      }).eq("id", inserted.id);
      return { status: "simulated" as const, id: inserted.id };
    }
    try {
      const from = `${settings?.sender_name ?? "Tata Na Baczności"} <${settings?.sender_local_part ?? "kontakt"}@${settings?.sender_domain ?? "tatanabacznosci.pl"}>`;
      const sent = await sendSmtpMail({ to: recipient, from, replyTo: settings?.reply_to ?? null, subject: rendered.subject, html: rendered.html, text: rendered.text });
      await db.from("email_notification_log").update({ status: "sent", mode: "live", attempts: 1, reason: null, provider_message_id: sent.messageId, updated_at: new Date().toISOString() }).eq("id", inserted.id);
      return { status: "sent" as const, id: inserted.id };
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 300) : "smtp_delivery_failed";
      await db.from("email_notification_log").update({ status: "failed", mode: "live", attempts: 1, reason, updated_at: new Date().toISOString() }).eq("id", inserted.id);
      return { status: "failed" as const, id: inserted.id, reason: "smtp_delivery_failed" };
    }
  } catch (error) {
    console.error("order notification failed", error instanceof Error ? error.message : error);
    return { status: "failed" as const, reason: "internal_error" };
  }
}
async function notifyOrder(db: Db, orderId: string, event: string, key?: string) {
  return dispatchOrderNotification(db, orderId, event, key);
}
async function afterPaid(db: Db, orderId: string) {
  // The database trigger enqueues both notifications in the same transaction
  // as the paid_at transition. Never send synchronously from webhook/admin paths.
  await logOrderEvent(db, orderId, "delivery_queued", "Powiadomienia i dostarczenie materiału przekazano do trwałej kolejki.");
}

async function requireCron(db: Db, req: Request) {
  const token = parseBearerToken(req.headers.get("authorization")) ?? "";
  if (!token) throw new HttpError(401, "Unauthorized");
  const { data: vaultSecret, error: vaultError } = await db.rpc("get_tnb_cron_secret");
  const secrets = [
    ...(typeof vaultSecret === "string" && vaultSecret ? [vaultSecret] : []),
    ...["TNB_CRON_SECRET", "TNB_CRON_SECRET_PREVIOUS"].map((name) => envKey(name)).filter((value): value is string => !!value),
  ];
  if (!secrets.length) {
    if (vaultError) console.error("Delivery cron secret lookup failed:", vaultError.code ?? "unknown");
    throw new HttpError(503, "Zadanie cykliczne nie jest skonfigurowane.");
  }
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

async function processDeliveryOutbox(db: Db) {
  const worker = "tnb-orders-" + crypto.randomUUID();
  const { data: jobs, error } = await db.rpc("claim_library_delivery_outbox", { p_worker: worker, p_limit: 3 });
  if (error) throw new HttpError(500, "Nie udało się pobrać kolejki dostarczania.");
  const counts = { claimed: jobs?.length ?? 0, sent: 0, simulated: 0, skipped: 0, needsReview: 0 };
  for (const job of jobs ?? []) {
    const event = String(job.event_key);
    const idempotencyKey = event + "-" + String(job.order_id);
    if (event === "order_access_delivered" || event === "order_guest_access") {
      const { data: orderState } = await db.from("library_orders")
        .select("delivery_status, delivered_at").eq("id", job.order_id).maybeSingle();
      if (orderState?.delivery_status === "sent" || orderState?.delivered_at) {
        await db.rpc("finish_library_delivery_outbox", {
          p_id: job.id, p_status: "skipped", p_error: "delivery_already_marked_complete", p_safe_to_retry: false,
        });
        counts.skipped++;
        continue;
      }
    }
    const { data: existing, error: logError } = await db.from("email_notification_log")
      .select("status").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (logError) {
      await db.rpc("finish_library_delivery_outbox", { p_id: job.id, p_status: "needs_review", p_error: "notification_log_lookup_failed", p_safe_to_retry: false });
      if (event === "order_access_delivered" || event === "order_guest_access") {
        await db.from("library_orders").update({ delivery_status: "not_sent", delivery_error: "needs_review:notification_log_lookup_failed" }).eq("id", job.order_id);
      }
      counts.needsReview++;
      continue;
    }
    // An interrupted SMTP send is ambiguous. Never resend it automatically:
    // an operator can inspect the provider/log and decide whether to resend.
    if (existing) {
      const terminal = ["sent", "delivered", "simulated", "skipped"].includes(existing.status);
      await db.rpc("finish_library_delivery_outbox", {
        p_id: job.id, p_status: terminal ? (existing.status === "delivered" ? "sent" : existing.status) : "needs_review",
        p_error: terminal ? null : "previous_notification_attempt_" + existing.status,
        p_safe_to_retry: false,
      });
      if (event === "order_access_delivered" || event === "order_guest_access") {
        const wasSent = existing.status === "sent" || existing.status === "delivered";
        await db.from("library_orders").update({
          delivery_status: wasSent ? "sent" : "not_sent",
          delivery_error: wasSent ? null : terminal ? existing.status : "needs_review:previous_notification_attempt_" + existing.status,
          ...(wasSent ? { delivered_at: new Date().toISOString() } : {}),
        }).eq("id", job.order_id);
      }
      if (terminal) {
        if (existing.status === "sent" || existing.status === "delivered") counts.sent++;
        else if (existing.status === "simulated") counts.simulated++;
        else counts.skipped++;
      } else counts.needsReview++;
      continue;
    }
    const result = await dispatchOrderNotification(db, String(job.order_id), event);
    const reason = "reason" in result ? result.reason : result.status;
    const decision = getOutboxFinishDecision(result.status, reason);
    const terminal = decision.status === "sent" || decision.status === "simulated" || decision.status === "skipped";
    const { error: finishError } = await db.rpc("finish_library_delivery_outbox", {
      p_id: job.id, p_status: decision.status, p_error: terminal ? null : reason,
      p_safe_to_retry: decision.safeToRetry,
    });
    if (finishError) {
      console.error("delivery outbox completion failed", job.id, finishError.message);
      if (event === "order_access_delivered" || event === "order_guest_access") {
        await db.from("library_orders").update({ delivery_status: "not_sent", delivery_error: "needs_review:outbox_completion_failed" }).eq("id", job.order_id);
      }
      counts.needsReview++;
      continue;
    }
    if (result.status === "sent") counts.sent++;
    else if (result.status === "simulated") counts.simulated++;
    else if (result.status === "skipped") counts.skipped++;
    else counts.needsReview++;
    if (event === "order_access_delivered" || event === "order_guest_access") {
      await db.from("library_orders").update({
        delivery_status: result.status === "sent" ? "sent" : "not_sent",
        delivery_error: result.status === "sent" ? null : result.status === "simulated" ? "simulated" : reason ?? result.status,
        ...(result.status === "sent" ? { delivered_at: new Date().toISOString() } : {}),
      }).eq("id", job.order_id);
      if (result.status === "sent") {
        await logOrderEvent(db, String(job.order_id), "access_granted", "Link do materiału wysłano po potwierdzeniu płatności.");
      }
    }
  }
  return counts;
}

async function markPaid(db: Db, orderId: string, actor: string) {
  const now = new Date().toISOString();
  const { data } = await db.from("library_orders").update({
    status: "paid", paid_at: now, paid_marked_by: actor, status_changed_by: actor, status_changed_at: now, access_expires_at: null,
  }).eq("id", orderId).eq("status", "pending").eq("payment_method", "bank_transfer").select("id");
  if (!data?.length) return false;
  await logOrderEvent(db, orderId, "paid", "Wpłata przelewem potwierdzona ręcznie przez administratora.");
  await afterPaid(db, orderId);
  return true;
}
async function markDelivered(db: Db, orderId: string, actor: string) {
  const now = new Date().toISOString();
  const { data } = await db.from("library_orders").update({
    delivery_status: "sent", delivery_error: null, delivered_at: now, delivered_marked_by: actor, status_changed_by: actor, status_changed_at: now,
  }).eq("id", orderId).in("status", ["paid"]).select("id");
  if (!data?.length) return false;
  await logOrderEvent(db, orderId, "delivered_manual", "Administrator oznaczył materiał jako przekazany.");
  return true;
}
async function cancelOrder(db: Db, orderId: string, actor: string) {
  const now = new Date().toISOString();
  const { data } = await db.from("library_orders").update({
    status: "cancelled", cancelled_at: now, status_changed_by: actor, status_changed_at: now,
  }).eq("id", orderId).in("status", ["pending", "failed", "needs_review"]).select("id");
  if (!data?.length) return false;
  await logOrderEvent(db, orderId, "cancelled", "Anulowane przez administratora.");
  await notifyOrder(db, orderId, "order_cancelled");
  return true;
}
async function startRefund(db: Db, orderId: string, actor: string, reason: string) {
  const now = new Date().toISOString();
  const { data } = await db.from("library_orders").update({
    status: "refund_pending", refund_reason: reason, status_changed_by: actor, status_changed_at: now,
  }).eq("id", orderId).eq("status", "paid").select("id");
  if (!data?.length) return false;
  await logOrderEvent(db, orderId, "refund_pending", "Zwrot w toku. Przyczyna: " + reason);
  return true;
}
async function completeRefund(db: Db, orderId: string, actor: string, revokeAccess: boolean) {
  const now = new Date().toISOString();
  const { data } = await db.from("library_orders").update({
    status: "refunded", refunded_at: now, access_revoked_at: revokeAccess ? now : null, status_changed_by: actor, status_changed_at: now,
  }).eq("id", orderId).eq("status", "refund_pending").select("id");
  if (!data?.length) return false;
  await logOrderEvent(db, orderId, "refunded", revokeAccess ? "Zwrot zakończony. Dostęp do materiału cofnięty." : "Zwrot zakończony. Dostęp do materiału pozostawiony.");
  await notifyOrder(db, orderId, "order_refunded");
  return true;
}
async function resolveReview(db: Db, orderId: string, actor: string, decision: "paid" | "failed") {
  const now = new Date().toISOString();
  const patch = decision === "paid"
    ? { status: "paid", paid_at: now, paid_marked_by: actor, status_changed_by: actor, status_changed_at: now }
    : { status: "failed", failed_at: now, status_changed_by: actor, status_changed_at: now };
  const { data } = await db.from("library_orders").update(patch).eq("id", orderId).eq("status", "needs_review").select("id");
  if (!data?.length) return false;
  await logOrderEvent(db, orderId, decision === "paid" ? "paid" : "failed",
    decision === "paid" ? "Administrator potwierdził płatność po weryfikacji w panelu operatora." : "Administrator uznał płatność za nieudaną po weryfikacji.");
  if (decision === "paid") await afterPaid(db, orderId);
  return true;
}
async function resendAccess(db: Db, orderId: string, key: string) {
  const { data: order } = await db.from("library_orders").select("status, paid_at, access_revoked_at, user_id").eq("id", orderId).maybeSingle();
  if (!order || !hasAccess(order)) return { ok: false as const, reason: "not_paid" };
  const result = await notifyOrder(db, orderId, order.user_id ? "order_access_delivered" : "order_guest_access", key);
  await logOrderEvent(db, orderId, "access_resent",
    result.status === "sent" ? "Link do materiału wysłany ponownie." :
    "Link do materiału przygotowany ponownie (" + (result.status === "simulated" ? "symulacja — nie wysłano" : result.reason ?? result.status) + ").");
  return result.status === "sent" ? { ok: true as const } : { ok: false as const, reason: result.status === "simulated" ? "simulated" : result.reason ?? result.status };
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("processDeliveryOutbox") }),
  z.object({ action: z.literal("getCheckoutOptions") }),
  z.object({ action: z.literal("createLibraryOrder"), data: z.object({
    slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
    name: z.string().trim().min(3, "Podaj imię i nazwisko.").max(120),
    email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
    phone: z.string().trim().max(20).regex(/^$|^\+?[0-9 ()-]{7,20}$/, "Podaj poprawny numer telefonu.").default(""),
    method: z.enum(["bank_transfer", ...PROVIDERS], { errorMap: () => ({ message: "Wybierz dostępną metodę płatności." }) }),
    consent: z.literal(true, { errorMap: () => ({ message: "Zaakceptuj wymagane zgody." }) }),
    idempotencyKey: z.string().uuid().optional(),
  }) }),
  z.object({ action: z.literal("getPurchasedMaterial"), data: z.object({ token: z.string().uuid(), file: z.boolean().default(false) }) }),
  z.object({ action: z.literal("recoverAccess"), data: z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    number: z.string().trim().toUpperCase().regex(/^TNB-\d{4}-\d{1,10}$/, "Podaj numer zamówienia, np. TNB-2026-12."),
  }) }),
  z.object({ action: z.literal("listMyPurchases") }),
  z.object({ action: z.literal("adminListOrders"), data: z.object({
    q: z.string().trim().max(100).default(""),
    status: z.enum(["all", ...STATUSES]).default("all"),
    provider: z.enum(["all", "manual", ...PROVIDERS]).default("all"),
    from: z.string().max(10).default(""), to: z.string().max(10).default(""),
    kind: z.enum(["all", "real", "test"]).default("all"),
  }) }),
  z.object({ action: z.literal("adminSalesSummary") }),
  z.object({ action: z.literal("adminGetOrder"), data: z.object({ id: z.string().uuid() }) }),
  z.object({ action: z.literal("adminResendDelivery"), data: z.object({ id: z.string().uuid() }) }),
  z.object({ action: z.literal("adminSetOrderStatus"), data: z.object({
    id: z.string().uuid(),
    action: z.enum(["paid", "delivered", "cancelled", "refund_start", "refund_complete", "review_paid", "review_failed"]),
    reason: z.string().trim().max(500).default(""),
    revokeAccess: z.boolean().default(false),
    confirmNumber: z.string().trim().max(40).default(""),
  }) }),
]);

async function getCheckoutOptions(db: Db) {
  const { data, error } = await db.from("payment_providers").select("id, enabled, is_default, environment, merchant_id, pos_id, client_id");
  if (error) throw new HttpError(500, "Nie udało się pobrać metod płatności.");
  const providers = (data ?? []).filter((p) => (p as CheckoutProviderRow).enabled && configStatus(p as ProviderRow).configured)
    .map((p) => ({ id: p.id as ProviderId, label: PROVIDER_LABEL[p.id]!, isDefault: p.is_default, test: p.environment === "sandbox" }));
  return { providers };
}

async function createLibraryOrder(db: Db, req: Request, data: z.infer<typeof actionSchema> & { action: "createLibraryOrder" }) {
  const input = data.data;
  // Keep the endpoint backward-compatible during the SPA/Edge rollout. New SPA clients persist the key; legacy clients receive a one-request key.
  const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
  const { data: item, error: itemError } = await db.from("library_items")
    .select("id, title, access, status, purchasable, price_amount, currency").eq("slug", input.slug).maybeSingle();
  if (itemError || !item || item.status !== "published" || item.access !== "premium" || !item.purchasable || !item.price_amount || item.price_amount < 100) {
    return { error: "Ten materiał nie jest obecnie dostępny do zakupu." };
  }
  const user = await getUser(db, req);
  const online = input.method !== "bank_transfer";
  if (!online) return { error: "Płatność przelewem bankowym jest obecnie niedostępna." };
  const provider = await providerRow(db, input.method as ProviderId);
  if (!provider?.enabled || !configStatus(provider).configured) return { error: "Ta metoda płatności jest obecnie niedostępna." };
  const fingerprint = await checkoutFingerprint({
    itemId: item.id, method: input.method as ProviderId, email: input.email, name: input.name,
    phone: input.phone || "", amount: item.price_amount, currency: item.currency || "PLN", userId: user?.id ?? null,
  });
  const { data: order, error } = await db.from("library_orders").insert({
    item_id: item.id, user_id: user?.id ?? null, buyer_email: input.email, buyer_name: input.name, buyer_phone: input.phone || null,
    amount: item.price_amount, currency: item.currency || "PLN", status: "pending", provider: input.method, payment_method: "online",
    environment: provider.environment, consent_text: CONSENT, checkout_idempotency_key: idempotencyKey,
    checkout_request_fingerprint: fingerprint, checkout_state: "creating",
  }).select("id, access_token, order_number").single();
  if (error?.code === "23505") {
    const { data: existing } = await db.from("library_orders")
      .select("id, access_token, order_number, checkout_request_fingerprint, checkout_state")
      .eq("checkout_idempotency_key", idempotencyKey).maybeSingle();
    if (!existing) throw new HttpError(409, "To zamówienie jest już przetwarzane. Odśwież status za chwilę.");
    if (existing.checkout_request_fingerprint !== fingerprint) throw new HttpError(409, "Ten klucz zamówienia został już użyty z innymi danymi.");
    if (existing.checkout_state === "ready") {
      const { data: session } = await db.from("library_checkout_sessions")
        .select("redirect_url").eq("idempotency_key", idempotencyKey).maybeSingle();
      if (session?.redirect_url) return { token: existing.access_token, redirectUrl: session.redirect_url };
    }
    throw new HttpError(409, existing.checkout_state === "needs_review"
      ? "Płatność wymaga sprawdzenia. Nie ponawiaj zamówienia — skontaktuj się z obsługą."
      : "Zamówienie jest już przetwarzane. Poczekaj chwilę przed ponowieniem.");
  }
  if (error || !order) {
    console.error("order insert failed", error?.message);
    return { error: "Nie udało się złożyć zamówienia. Spróbuj ponownie." };
  }
  await logOrderEvent(db, order.id, "created", "Zamówienie złożone " + (user ? "na koncie" : "bez konta") + ", metoda: " + PROVIDER_LABEL[input.method] + (provider.environment === "sandbox" ? " (test)" : "") + ".");
  await notifyOrder(db, order.id, "order_created");
  await notifyOrder(db, order.id, "order_admin_new");
  const baseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const origin = siteOrigin();
  const customerIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") || "";
  const result = await ADAPTERS[input.method as ProviderId].create(provider, {
    orderId: order.id, orderNumber: order.order_number, amount: item.price_amount, currency: item.currency || "PLN",
    email: input.email, name: input.name, description: order.order_number + " — " + item.title,
    returnUrl: origin + "/zakup/" + order.access_token + "?powrot=1",
    notifyUrl: baseUrl + "/functions/v1/tnb-payments?provider=" + input.method,
    customerIp,
  }).catch((error) => ({ ok: false as const, reason: error instanceof Error ? error.message : "error" }));
  if (!result.ok) {
    // Provider timeouts can be ambiguous: never create a second transaction automatically.
    await db.from("library_orders").update({ checkout_state: "needs_review", review_reason: "checkout_provider_result_ambiguous" }).eq("id", order.id).eq("checkout_state", "creating");
    await logOrderEvent(db, order.id, "checkout_needs_review", "Nie można jednoznacznie potwierdzić wyniku utworzenia transakcji u operatora.");
    return { error: "Nie udało się potwierdzić wyniku u operatora. Zamówienie wymaga sprawdzenia; nie ponawiaj płatności." };
  }
  const { error: sessionError } = await db.from("library_checkout_sessions").insert({
    idempotency_key: idempotencyKey, order_id: order.id, redirect_url: result.redirectUrl,
  });
  if (sessionError) {
    console.error("checkout session persistence failed", sessionError.message);
    await db.from("library_orders").update({ checkout_state: "needs_review", review_reason: "checkout_session_persistence_failed" }).eq("id", order.id);
    throw new HttpError(503, "Operator utworzył transakcję, ale zapis wyniku wymaga sprawdzenia. Nie ponawiaj płatności.");
  }
  const { error: saveError } = await db.from("library_orders").update({
    provider_ref: result.providerRef, checkout_session_id: result.providerRef, checkout_state: "ready",
  }).eq("id", order.id).eq("checkout_state", "creating");
  if (saveError) {
    console.error("checkout result persistence failed", saveError.message);
    await db.from("library_orders").update({ checkout_state: "needs_review", review_reason: "checkout_order_persistence_failed" }).eq("id", order.id);
    throw new HttpError(503, "Operator utworzył transakcję, ale zapis wyniku wymaga sprawdzenia. Nie ponawiaj płatności.");
  }
  await logOrderEvent(db, order.id, "checkout_started", "Transakcja utworzona u operatora (" + result.providerRef + "). Przekierowanie do płatności.");
  return { token: order.access_token, redirectUrl: result.redirectUrl };
}

async function getPurchasedMaterial(db: Db, data: { token: string; file: boolean }) {
  const { data: order } = await db.from("library_orders")
    .select("item_id, status, paid_at, access_revoked_at, access_expires_at, order_number, amount, buyer_email, payment_method, provider, library_items(title, slug)")
    .eq("access_token", data.token).maybeSingle();
  if (!order) return { error: "Link jest nieprawidłowy." };
  if (!hasAccess(order)) {
    const item = order.library_items as unknown as { title: string; slug: string } | null;
    return { order: { status: order.status, number: order.order_number, amount: order.amount, email: order.buyer_email, title: item?.title ?? "", slug: item?.slug ?? "", method: order.payment_method, provider: PROVIDER_LABEL[order.provider ?? ""] ?? null } };
  }
  if (order.access_expires_at && new Date(order.access_expires_at) < new Date()) return { error: "Link wygasł. Poproś o nowy na stronie materiału." };
  const { data: item } = await db.from("library_items").select("title, slug, summary, kind").eq("id", order.item_id).maybeSingle();
  const { data: content } = await db.from("library_item_content").select("body, file_path, file_name, external_url").eq("item_id", order.item_id).maybeSingle();
  if (data.file) {
    if (!content?.file_path) return { error: "Ten materiał nie ma pliku." };
    const { data: signed } = await db.storage.from("library-files").createSignedUrl(content.file_path, 300);
    if (!signed) return { error: "Nie udało się przygotować pliku." };
    return { url: signed.signedUrl };
  }
  return { item, body: content?.body ?? "", hasFile: !!content?.file_path, fileName: content?.file_name ?? null, externalUrl: content?.external_url ?? null, expiresAt: order.access_expires_at };
}

async function recoverAccess(db: Db, data: { email: string; number: string }) {
  const { data: order } = await db.from("library_orders").select("id").eq("order_number", data.number).eq("buyer_email", data.email).maybeSingle();
  if (order) await resendAccess(db, order.id, "recover-" + new Date().toISOString().slice(0, 13));
  return { ok: true };
}

async function listMyPurchases(db: Db, userId: string, email: string | null) {
  let query = db.from("library_orders").select("id, status, paid_at, amount, access_token, access_revoked_at, library_items(title, slug)")
    .not("paid_at", "is", null).is("access_revoked_at", null).in("status", ["paid", "refund_pending", "refunded"]);
  query = email ? query.or("user_id.eq." + userId + ",buyer_email.eq." + email) : query.eq("user_id", userId);
  const { data, error } = await query.order("paid_at", { ascending: false });
  if (error) throw new HttpError(500, "Nie udało się pobrać zakupów.");
  return (data ?? []).map((order) => ({
    id: order.id, paid_at: order.paid_at, amount: order.amount, title: order.library_items?.title ?? "",
    slug: order.library_items?.slug ?? "", token: order.access_token,
  }));
}
async function adminListOrders(db: Db, input: AdminOrderFilters) {
  let query = db.from("library_orders").select("id, order_number, created_at, paid_at, delivered_at, status, delivery_status, buyer_email, buyer_name, amount, currency, payment_method, provider, environment, is_test, access_revoked_at, library_items!inner(title)")
    .order("created_at", { ascending: false }).limit(500);
  if (input.status !== "all") query = query.eq("status", input.status);
  if (input.provider !== "all") query = query.eq("provider", input.provider);
  if (input.kind !== "all") query = query.eq("is_test", input.kind === "test");
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.from)) query = query.gte("created_at", input.from + "T00:00:00");
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.to)) query = query.lte("created_at", input.to + "T23:59:59");
  const { data, error } = await query;
  if (error) throw new HttpError(500, "Nie udało się pobrać zamówień.");
  const search = input.q.toLowerCase();
  return (data as AdminOrderRow[]).filter((row) => !search ||
    row.order_number.toLowerCase().includes(search) || row.buyer_email.toLowerCase().includes(search) ||
    (row.buyer_name ?? "").toLowerCase().includes(search) || (row.library_items?.title ?? "").toLowerCase().includes(search));
}
async function adminSalesSummary(db: Db) {
  const { data, error } = await db.from("library_orders")
    .select("status, amount, provider, environment, is_test, paid_at, created_at").limit(20000);
  if (error) throw new HttpError(500, "Nie udało się pobrać podsumowania sprzedaży.");
  const rows = (data ?? []) as SalesRow[];
  const real = rows.filter((row) => row.environment !== "sandbox" && !row.is_test);
  const paid = real.filter((row) => row.paid_at && ["paid", "refund_pending"].includes(row.status));
  const sum = (items: SalesRow[]) => items.reduce((total, row) => total + row.amount, 0);
  const byProvider: Record<string, { count: number; amount: number }> = {};
  for (const row of paid) {
    const key = row.provider ?? "manual";
    byProvider[key] ??= { count: 0, amount: 0 };
    byProvider[key].count++;
    byProvider[key].amount += row.amount;
  }
  const month = new Date().toISOString().slice(0, 7);
  return {
    paidCount: paid.length, paidAmount: sum(paid),
    monthAmount: sum(paid.filter((row) => String(row.paid_at).startsWith(month))),
    pending: real.filter((row) => row.status === "pending").length,
    review: real.filter((row) => row.status === "needs_review").length,
    refunded: real.filter((row) => row.status === "refunded").length,
    refundedAmount: sum(real.filter((row) => row.status === "refunded")),
    byProvider, testOrders: rows.length - real.length,
  };
}
async function adminGetOrder(db: Db, id: string) {
  const { data: order } = await db.from("library_orders")
    .select("id, order_number, created_at, updated_at, paid_at, delivered_at, cancelled_at, refunded_at, failed_at, status, delivery_status, delivery_error, buyer_email, buyer_name, buyer_phone, amount, currency, payment_method, provider, provider_ref, environment, is_test, user_id, access_expires_at, access_revoked_at, refund_reason, review_reason, paid_marked_by, delivered_marked_by, status_changed_by, status_changed_at, library_items(title, slug)")
    .eq("id", id).maybeSingle();
  if (!order) throw new HttpError(404, "Nie znaleziono zamówienia.");
  const [{ data: events }, { data: mails }] = await Promise.all([
    db.from("library_order_events").select("type, detail, created_at").eq("order_id", id).order("created_at"),
    db.from("email_notification_log").select("kind, template_key, status, reason, created_at").eq("related_id", id).order("created_at"),
  ]);
  const ids = [order.paid_marked_by, order.delivered_marked_by, order.status_changed_by].filter(Boolean) as string[];
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
    for (const user of users?.users ?? []) if (ids.includes(user.id)) names[user.id] = user.email ?? user.id;
  }
  return { order, access: hasAccess(order), events: events ?? [], mails: mails ?? [], names };
}
async function adminResendDelivery(db: Db, id: string, actor: string) {
  const result = await resendAccess(db, id, "admin-" + crypto.randomUUID());
  await logEvent(db, { type: "order_resend", actor, objectKind: "order", objectId: id, result: result.ok ? "ok" : "failed", detail: result.ok ? undefined : result.reason });
  return result;
}
async function adminSetOrderStatus(db: Db, userId: string, input: AdminOrderAction) {
  if (input.action.startsWith("refund") || input.action.startsWith("review")) {
    const { data: order } = await db.from("library_orders").select("order_number").eq("id", input.id).maybeSingle();
    if (!order || order.order_number !== input.confirmNumber.toUpperCase()) throw new HttpError(400, "Wpisz dokładny numer zamówienia, aby potwierdzić.");
  }
  if (input.action === "refund_start" && input.reason.length < 3) throw new HttpError(400, "Podaj przyczynę zwrotu.");
  const action = input.action;
  const ok = action === "paid" ? await markPaid(db, input.id, userId)
    : action === "delivered" ? await markDelivered(db, input.id, userId)
    : action === "cancelled" ? await cancelOrder(db, input.id, userId)
    : action === "refund_start" ? await startRefund(db, input.id, userId, input.reason)
    : action === "refund_complete" ? await completeRefund(db, input.id, userId, input.revokeAccess)
    : await resolveReview(db, input.id, userId, action === "review_paid" ? "paid" : "failed");
  await logEvent(db, { type: "order_" + action, actor: userId, objectKind: "order", objectId: input.id, result: ok ? "ok" : "failed", detail: input.reason || undefined });
  if (!ok) throw new HttpError(400, action === "paid"
    ? "Ręcznie można potwierdzić tylko oczekujący przelew tradycyjny. Płatności online potwierdza wyłącznie operator."
    : "Tej zmiany nie można wykonać przy obecnym statusie zamówienia.");
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ message: "Niedozwolona metoda." }, 405);
  try {
    const db = adminClient();
    const parsed = actionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ message: "Nieprawidłowe żądanie." }, 400);
    const input = parsed.data;
    if (input.action === "processDeliveryOutbox") {
      await requireCron(db, req);
      return json(await processDeliveryOutbox(db));
    }
    switch (input.action) {
      case "getCheckoutOptions": return json(await getCheckoutOptions(db));
      case "createLibraryOrder": return json(await createLibraryOrder(db, req, input));
      case "getPurchasedMaterial": return json(await getPurchasedMaterial(db, input.data));
      case "recoverAccess": return json(await recoverAccess(db, input.data));
      case "listMyPurchases": {
        const user = await requireSignedIn(db, req);
        return json(await listMyPurchases(db, user.id, user.email?.toLowerCase() ?? null));
      }
      case "adminListOrders": {
        await requireAdmin(db, req);
        return json(await adminListOrders(db, input.data));
      }
      case "adminSalesSummary": {
        await requireAdmin(db, req);
        return json(await adminSalesSummary(db));
      }
      case "adminGetOrder": {
        await requireAdmin(db, req);
        return json(await adminGetOrder(db, input.data.id));
      }
      case "adminResendDelivery": {
        const user = await requireAdmin(db, req);
        return json(await adminResendDelivery(db, input.data.id, user.id));
      }
      case "adminSetOrderStatus": {
        const user = await requireAdmin(db, req);
        return json(await adminSetOrderStatus(db, user.id, input.data));
      }
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Wystąpił błąd serwera.";
    if (status >= 500) console.error("tnb-orders error:", message);
    return json({ message }, status);
  }
  return json({ message: "Nieznana operacja." }, 400);
});
