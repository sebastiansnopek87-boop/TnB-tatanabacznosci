// Server-only order core shared by bank transfer and all payment operators.
// Every status transition is guarded by the current status in the UPDATE, so a
// repeated webhook or double click cannot apply twice or grant access twice.
// Only two paths can set "paid": a signature-verified operator notification
// (confirmOperatorPayment) or an admin confirming a bank transfer (markOrderPaid).
import type { Notice, ProviderId, ProviderRow } from "./payments/providers.server";

async function db() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function logOrderEvent(orderId: string, type: string, detail?: string | null) {
  const s = await db();
  await s.from("library_order_events").insert({ order_id: orderId, type, detail: detail?.slice(0, 500) ?? null });
}

export function siteOrigin(): string {
  return process.env["PUBLIC_SITE_URL"] || "https://project--182d8df3-9e8b-4c28-9f51-3ca8313666e7.lovable.app";
}

const zl = (a: number) => `${(a / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`;
const ACCESS_STATUSES = ["paid", "refund_pending", "refunded"];
export const hasAccess = (o: { status: string; paid_at: string | null; access_revoked_at: string | null }) =>
  !!o.paid_at && !o.access_revoked_at && ACCESS_STATUSES.includes(o.status);

type OrderEvent = "order_created" | "order_paid" | "order_access_delivered" | "order_guest_access" | "order_payment_failed" | "order_cancelled" | "order_refunded" | "order_admin_new";

// All order e-mails go through the central notification engine (test mode = simulation).
export async function notifyOrder(orderId: string, event: OrderEvent, key?: string) {
  const s = await db();
  const { data: o } = await s.from("library_orders").select("id, order_number, buyer_email, buyer_name, amount, access_token, user_id, library_items(title)").eq("id", orderId).maybeSingle();
  if (!o) return { status: "skipped" as const, reason: "order_not_found" };
  const { dispatch } = await import("./notifications.server");
  const title = (o.library_items as unknown as { title: string } | null)?.title ?? "Materiał";
  return dispatch({
    event, to: event === "order_admin_new" ? null : o.buyer_email, relatedId: o.id, idempotencyKey: `${event}-${o.id}${key ? `-${key}` : ""}`,
    vars: {
      imie: (o.buyer_name ?? "").trim().split(/\s+/)[0] || "Kliencie", email: o.buyer_email, numer_zamowienia: o.order_number,
      kwota: zl(o.amount), tytul_materialu: title, link_do_materialu: `${siteOrigin()}/zakup/${o.access_token}`,
      link_do_logowania: `${siteOrigin()}/auth`, link_do_panelu: `${siteOrigin()}/admin/zamowienia`,
    },
  });
}

async function afterPaid(orderId: string) {
  const s = await db();
  const { data: o } = await s.from("library_orders").select("user_id").eq("id", orderId).maybeSingle();
  await notifyOrder(orderId, "order_paid");
  const r = await notifyOrder(orderId, o?.user_id ? "order_access_delivered" : "order_guest_access");
  await s.from("library_orders").update({ delivery_status: r.status === "sent" ? "sent" : "not_sent", delivery_error: r.status === "sent" ? null : (r.status === "simulated" ? "simulated" : r.reason ?? r.status) }).eq("id", orderId);
  await logOrderEvent(orderId, "access_granted", "Dostęp do materiału przyznany automatycznie po potwierdzeniu płatności.");
}

// Admin confirmation of a bank transfer. Never allowed for operator orders.
export async function markOrderPaid(orderId: string, actor: string) {
  const s = await db();
  const now = new Date().toISOString();
  const { data } = await s.from("library_orders")
    .update({ status: "paid", paid_at: now, paid_marked_by: actor, status_changed_by: actor, status_changed_at: now, access_expires_at: null })
    .eq("id", orderId).eq("status", "pending").eq("payment_method", "bank_transfer").select("id");
  if (!data?.length) return false;
  await logOrderEvent(orderId, "paid", "Wpłata przelewem potwierdzona ręcznie przez administratora.");
  await afterPaid(orderId);
  return true;
}

export async function markOrderDelivered(orderId: string, actor: string) {
  const s = await db();
  const now = new Date().toISOString();
  const { data } = await s.from("library_orders").update({ delivery_status: "sent", delivery_error: null, delivered_at: now, delivered_marked_by: actor, status_changed_by: actor, status_changed_at: now })
    .eq("id", orderId).in("status", ["paid"]).select("id");
  if (!data?.length) return false;
  await logOrderEvent(orderId, "delivered_manual", "Administrator oznaczył materiał jako przekazany.");
  return true;
}

export async function cancelOrder(orderId: string, actor: string) {
  const s = await db();
  const now = new Date().toISOString();
  const { data } = await s.from("library_orders").update({ status: "cancelled", cancelled_at: now, status_changed_by: actor, status_changed_at: now })
    .eq("id", orderId).in("status", ["pending", "failed", "needs_review"]).select("id");
  if (!data?.length) return false;
  await logOrderEvent(orderId, "cancelled", "Anulowane przez administratora.");
  await notifyOrder(orderId, "order_cancelled");
  return true;
}

// Refund flow: paid → refund_pending → refunded. Access revoke is the admin's decision.
export async function startRefund(orderId: string, actor: string, reason: string) {
  const s = await db();
  const now = new Date().toISOString();
  const { data } = await s.from("library_orders").update({ status: "refund_pending", refund_reason: reason, status_changed_by: actor, status_changed_at: now })
    .eq("id", orderId).eq("status", "paid").select("id");
  if (!data?.length) return false;
  await logOrderEvent(orderId, "refund_pending", `Zwrot w toku. Przyczyna: ${reason}`);
  return true;
}

export async function completeRefund(orderId: string, actor: string, revokeAccess: boolean) {
  const s = await db();
  const now = new Date().toISOString();
  const { data } = await s.from("library_orders").update({ status: "refunded", refunded_at: now, access_revoked_at: revokeAccess ? now : null, status_changed_by: actor, status_changed_at: now })
    .eq("id", orderId).eq("status", "refund_pending").select("id");
  if (!data?.length) return false;
  await logOrderEvent(orderId, "refunded", revokeAccess ? "Zwrot zakończony. Dostęp do materiału cofnięty." : "Zwrot zakończony. Dostęp do materiału pozostawiony.");
  await notifyOrder(orderId, "order_refunded");
  return true;
}

// Admin decides a needs_review order after checking the operator panel.
export async function resolveReview(orderId: string, actor: string, decision: "paid" | "failed") {
  const s = await db();
  const now = new Date().toISOString();
  const patch = decision === "paid"
    ? { status: "paid", paid_at: now, paid_marked_by: actor, status_changed_by: actor, status_changed_at: now }
    : { status: "failed", failed_at: now, status_changed_by: actor, status_changed_at: now };
  const { data } = await s.from("library_orders").update(patch).eq("id", orderId).eq("status", "needs_review").select("id");
  if (!data?.length) return false;
  await logOrderEvent(orderId, decision === "paid" ? "paid" : "failed", decision === "paid" ? "Administrator potwierdził płatność po weryfikacji w panelu operatora." : "Administrator uznał płatność za nieudaną po weryfikacji.");
  if (decision === "paid") await afterPaid(orderId);
  return true;
}

// Re-sends the access link for a paid order (admin action or buyer recovery).
export async function resendAccess(orderId: string, key: string) {
  const s = await db();
  const { data: o } = await s.from("library_orders").select("status, paid_at, access_revoked_at, user_id").eq("id", orderId).maybeSingle();
  if (!o || !hasAccess(o)) return { ok: false as const, reason: "not_paid" };
  const r = await notifyOrder(orderId, o.user_id ? "order_access_delivered" : "order_guest_access", key);
  await logOrderEvent(orderId, "access_resent", r.status === "sent" ? "Link do materiału wysłany ponownie." : `Link do materiału przygotowany ponownie (${r.status === "simulated" ? "symulacja — nie wysłano" : r.reason ?? r.status}).`);
  return r.status === "sent" ? { ok: true as const } : { ok: false as const, reason: r.status === "simulated" ? "simulated" : r.reason ?? r.status };
}

// ---------------- operator confirmations ----------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function confirmOperatorPayment(p: ProviderRow, n: Notice): Promise<{ result: string }> {
  const s = await db();
  let q = s.from("library_orders").select("id, status, amount, currency, provider, provider_ref, environment");
  q = n.orderId && UUID.test(n.orderId) ? q.eq("id", n.orderId) : q.eq("provider", p.id).eq("provider_ref", n.providerRef);
  const { data: o } = await q.maybeSingle();
  if (!o) return { result: "order_not_found" };
  if (o.provider !== p.id) {
    await flagReview(o.id, `Powiadomienie od ${p.id}, a zamówienie przypisane do ${o.provider}.`);
    return { result: "provider_mismatch" };
  }
  if (o.environment !== p.environment) {
    await logOrderEvent(o.id, "webhook_rejected", `Powiadomienie ze środowiska ${p.environment}, zamówienie ze środowiska ${o.environment}.`);
    return { result: "env_mismatch" };
  }
  if (n.outcome === "pending") {
    await logOrderEvent(o.id, "webhook_pending", `Operator: płatność w toku (${n.eventId}).`);
    return { result: "pending" };
  }
  if (n.outcome === "failed") {
    const now = new Date().toISOString();
    const { data } = await s.from("library_orders").update({ status: "failed", failed_at: now, status_changed_at: now }).eq("id", o.id).eq("status", "pending").select("id");
    if (!data?.length) { await logOrderEvent(o.id, "duplicate_ignored", `Powiadomienie o nieudanej płatności przy statusie ${o.status} — pominięto.`); return { result: "ignored" }; }
    await logOrderEvent(o.id, "failed", "Operator zgłosił nieudaną płatność. Dostęp nie został przyznany.");
    await notifyOrder(o.id, "order_payment_failed");
    return { result: "failed" };
  }
  if (n.amount !== o.amount || n.currency.toUpperCase() !== o.currency.toUpperCase()) {
    await flagReview(o.id, `Niezgodna kwota lub waluta: operator ${n.amount} ${n.currency}, zamówienie ${o.amount} ${o.currency}.`);
    return { result: "amount_mismatch" };
  }
  const now = new Date().toISOString();
  const { data } = await s.from("library_orders").update({ status: "paid", paid_at: now, status_changed_at: now, provider_ref: o.provider_ref ?? n.providerRef, access_expires_at: null })
    .eq("id", o.id).in("status", ["pending", "failed"]).select("id");
  if (!data?.length) { await logOrderEvent(o.id, "duplicate_ignored", `Powtórzone potwierdzenie (${n.eventId}) przy statusie ${o.status} — pominięto.`); return { result: "duplicate" }; }
  await logOrderEvent(o.id, "paid", `Płatność potwierdzona przez operatora ${p.id} (zweryfikowany podpis).`);
  await afterPaid(o.id);
  return { result: "paid" };
}

async function flagReview(orderId: string, reason: string) {
  const s = await db();
  await s.from("library_orders").update({ status: "needs_review", review_reason: reason, status_changed_at: new Date().toISOString() }).eq("id", orderId).in("status", ["pending", "failed"]);
  await logOrderEvent(orderId, "needs_review", reason);
}

export async function loadProvider(id: ProviderId): Promise<ProviderRow | null> {
  const { data } = await (await db()).from("payment_providers").select("id, enabled, is_default, environment, merchant_id, pos_id, client_id").eq("id", id).maybeSingle();
  return data as ProviderRow | null;
}

// Shared webhook handler for every operator route.
export async function handleWebhook(id: ProviderId, request: Request): Promise<Response> {
  const { ADAPTERS, configStatus } = await import("./payments/providers.server");
  const { logEvent } = await import("./admin-auth.server");
  const raw = await request.text();
  if (raw.length > 20000) return new Response("Too large", { status: 413 });
  const p = await loadProvider(id);
  if (!p || !configStatus(p).configured) return new Response("Not configured", { status: 503 });
  let n: Notice | null = null;
  try { n = await ADAPTERS[id].notice(p, raw, request.headers); } catch (e) { console.error("webhook parse", id, e); }
  if (!n) {
    await logEvent({ type: "payment_webhook_invalid", objectKind: "payment", objectId: id, result: "denied", detail: "Nieprawidłowy podpis lub dane powiadomienia." });
    return new Response("Invalid signature", { status: 401 });
  }
  const s = await db();
  const { error: dupErr } = await s.from("payment_webhook_events").insert({ event_id: n.eventId, environment: p.environment, type: `${id}:${n.outcome}` });
  if (dupErr?.code === "23505") return ADAPTERS[id].ack();
  try {
    const r = await confirmOperatorPayment(p, n);
    await logEvent({ type: "payment_webhook", objectKind: "payment", objectId: n.orderId ?? n.providerRef, result: ["paid", "failed", "pending", "duplicate", "ignored"].includes(r.result) ? "ok" : "failed", detail: `${id}: ${r.result}` });
    return ADAPTERS[id].ack();
  } catch (e) {
    console.error("webhook processing", id, e);
    await s.from("payment_webhook_events").delete().eq("event_id", n.eventId);
    return new Response("Retry", { status: 500 });
  }
}
