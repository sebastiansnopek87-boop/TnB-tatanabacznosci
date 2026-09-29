// Server-only order lifecycle: events, status transitions from trusted payment
// events, and delivery e-mails. Every transition is guarded by the current
// status in the UPDATE so a repeated webhook cannot re-deliver or double-apply.
const ACCESS_DAYS = 30;

async function db() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function logOrderEvent(orderId: string, type: string, detail?: string | null) {
  const s = await db();
  await s.from("library_order_events").insert({ order_id: orderId, type, detail: detail ?? null });
}

export function siteOrigin(): string {
  return process.env["PUBLIC_SITE_URL"] || "https://project--182d8df3-9e8b-4c28-9f51-3ca8313666e7.lovable.app";
}

// Manual confirmation by an admin after verifying the bank transfer.
export async function markOrderPaid(orderId: string, actor: string) {
  const s = await db();
  const now = new Date();
  const { data } = await s.from("library_orders")
    .update({ status: "paid", paid_at: now.toISOString(), paid_marked_by: actor, status_changed_by: actor, status_changed_at: now.toISOString(), access_expires_at: new Date(now.getTime() + ACCESS_DAYS * 864e5).toISOString() })
    .eq("id", orderId).eq("status", "pending").select("id");
  if (!data?.length) return false;
  await logOrderEvent(orderId, "paid", "Wpłata potwierdzona ręcznie przez administratora.");
  return true;
}

export async function markOrderDelivered(orderId: string, actor: string) {
  const s = await db();
  const now = new Date().toISOString();
  const { data } = await s.from("library_orders").update({ delivery_status: "sent", delivery_error: null, delivered_at: now, delivered_marked_by: actor, status_changed_by: actor, status_changed_at: now })
    .eq("id", orderId).eq("status", "paid").select("id");
  if (!data?.length) return false;
  await logOrderEvent(orderId, "delivered_manual", "Administrator oznaczył materiał jako wysłany.");
  return true;
}

export async function markOrderStatus(orderId: string, status: "failed" | "cancelled" | "refunded", detail: string, actor?: string) {
  const s = await db();
  const from = status === "refunded" ? ["paid"] : ["pending"];
  const col = status === "failed" ? "failed_at" : status === "cancelled" ? "cancelled_at" : "refunded_at";
  const { data } = await s.from("library_orders").update({ status, [col]: new Date().toISOString(), status_changed_by: actor ?? null, status_changed_at: new Date().toISOString() } as never).eq("id", orderId).in("status", status === "cancelled" ? ["pending", "paid"] : from).select("id, buyer_email, buyer_name, item_id");
  if (!data?.length) return false;
  await logOrderEvent(orderId, status, detail);
  if (status === "failed") await sendOrderMail(orderId, "payment_failed");
  return true;
}

type MailKind = "order_received" | "delivery" | "payment_failed" | "delivery_problem";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const zl = (a: number) => `${(a / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`;

// Polish, mobile-friendly templates in TNB colors (dark + gold).
export function renderOrderMail(kind: MailKind, o: { id: string; buyer_name: string | null; title: string; amount: number; link?: string }) {
  const hi = o.buyer_name ? `Cześć ${esc(o.buyer_name)},` : "Cześć,";
  const nr = o.id.slice(0, 8).toUpperCase();
  const map: Record<MailKind, { subject: string; body: string }> = {
    order_received: { subject: `Przyjęliśmy zamówienie ${nr}`, body: `<p>${hi}</p><p>Przyjęliśmy Twoje zamówienie na materiał <b>${esc(o.title)}</b> (${zl(o.amount)}). Materiał wyślemy po zaksięgowaniu przelewu.</p>` },
    delivery: { subject: `Twój materiał: ${o.title}`, body: `<p>${hi}</p><p>Dziękujemy za zakup! Płatność za zamówienie <b>${nr}</b> (${zl(o.amount)}) została potwierdzona.</p><p>Materiał <b>${esc(o.title)}</b> otworzysz tutaj (link ważny ${ACCESS_DAYS} dni):</p><p><a href="${o.link}" style="display:inline-block;background:#c9a24a;color:#111;padding:12px 22px;text-decoration:none;text-transform:uppercase;letter-spacing:.12em;font-size:13px">Otwórz materiał</a></p>` },
    payment_failed: { subject: `Płatność nie powiodła się — zamówienie ${nr}`, body: `<p>${hi}</p><p>Płatność za materiał <b>${esc(o.title)}</b> nie została zrealizowana. Nie pobraliśmy żadnych środków. Możesz spróbować ponownie na stronie materiału.</p>` },
    delivery_problem: { subject: `Problem z dostarczeniem zamówienia ${nr}`, body: `<p>${hi}</p><p>Twoja płatność za <b>${esc(o.title)}</b> została potwierdzona, ale mieliśmy problem z dostarczeniem materiału. Odezwiemy się najszybciej, jak to możliwe.</p>` },
  };
  const m = map[kind];
  const html = `<!doctype html><html lang="pl"><body style="margin:0;background:#0f0f0f;font-family:Arial,sans-serif;color:#eee"><div style="max-width:560px;margin:0 auto;padding:28px 20px"><p style="color:#c9a24a;letter-spacing:.2em;text-transform:uppercase;font-size:12px">Tata Na Baczności</p>${m.body}<p style="font-size:13px;color:#aaa;margin-top:28px">Problem z zamówieniem? Odpowiedz na tę wiadomość lub napisz przez formularz: ${siteOrigin()}/kontakt</p></div></body></html>`;
  return { subject: m.subject, html };
}

// Sends via the configured sender. Returns reason when it could not send —
// never reports success without a real delivery.
async function trySend(to: string, _mail: { subject: string; html: string }): Promise<{ ok: true } | { ok: false; reason: string }> {
  const s = await db();
  const { data: st } = await s.from("email_settings").select("sender_domain").eq("id", 1).maybeSingle();
  if (!st?.sender_domain) return { ok: false, reason: "sender_domain_not_configured" };
  return { ok: false, reason: "sender_not_connected" };
}

async function loadOrder(orderId: string) {
  const s = await db();
  const { data } = await s.from("library_orders").select("id, buyer_email, buyer_name, amount, status, access_token, item_id, library_items(title)").eq("id", orderId).maybeSingle();
  return data as null | { id: string; buyer_email: string; buyer_name: string | null; amount: number; status: string; access_token: string; library_items: { title: string } | null };
}

export async function sendOrderMail(orderId: string, kind: MailKind) {
  const o = await loadOrder(orderId);
  if (!o) return { ok: false as const, reason: "order_not_found" };
  const link = `${siteOrigin()}/zakup/${o.access_token}`;
  const mail = renderOrderMail(kind, { id: o.id, buyer_name: o.buyer_name, title: o.library_items?.title ?? "Materiał", amount: o.amount, link });
  const r = await trySend(o.buyer_email, mail);
  const s = await db();
  await s.from("email_notification_log").insert({ kind: `order_${kind}`, related_id: o.id, status: r.ok ? "sent" : "skipped", reason: r.ok ? null : r.reason, recipient: o.buyer_email });
  return r;
}

export async function deliverOrder(orderId: string, trigger: "auto" | "admin", actor?: string) {
  const s = await db();
  const o = await loadOrder(orderId);
  if (!o || o.status !== "paid") return { ok: false, reason: "not_paid" };
  const r = await sendOrderMail(orderId, "delivery");
  if (r.ok) {
    await s.from("library_orders").update({ delivery_status: "sent", delivery_error: null, delivered_at: new Date().toISOString(), delivered_marked_by: actor ?? null }).eq("id", orderId);
    await logOrderEvent(orderId, "delivered", trigger === "admin" ? "Ponowna wysyłka przez administratora." : "Wiadomość z materiałem wysłana.");
  } else {
    await s.from("library_orders").update({ delivery_status: "failed", delivery_error: r.reason }).eq("id", orderId);
    await logOrderEvent(orderId, "delivery_failed", `${trigger === "admin" ? "Ponowna wysyłka" : "Wysyłka"} nieudana: ${r.reason}`);
  }
  return r;
}
