// Central notification engine (server-only). Every send goes through
// dispatch(): rule check -> recipient -> template (DB override or default) ->
// render with validation -> idempotent log row -> delivery or test capture.
// A failed e-mail never throws into the business operation that triggered it.
import { DEFAULT_TEMPLATES, EVENT_MAP } from "./notify/registry";
import { maskSensitive, render, stripSensitive, type Vars } from "./notify/render";

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
const LEGACY_TOGGLE: Record<string, "contact_notifications_enabled" | "newsletter_notifications_enabled"> = {
  contact_message: "contact_notifications_enabled", newsletter_signup: "newsletter_notifications_enabled",
};

async function db() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

// Delivery adapter. Live delivery uses Lovable's built-in e-mail once the
// sender domain is configured and verified; until then it reports honestly
// that the sender is not connected. Templates/events/logic do not change.
export function providerStatus(): { connected: boolean; reason: string } {
  return { connected: false, reason: "sender_not_connected" };
}
async function deliver(_m: { to: string; from: string; replyTo: string | null; subject: string; html: string; text: string; idempotencyKey: string }):
  Promise<{ ok: true; id: string | null } | { ok: false; reason: string; detail?: string }> {
  const s = providerStatus();
  return { ok: false, reason: s.reason };
}

export async function loadTemplate(key: string) {
  const def = DEFAULT_TEMPLATES[key];
  if (!def) return null;
  const { data } = await (await db()).from("email_templates").select("subject, html, text_body").eq("key", key).maybeSingle();
  return { key, required: def.required, subject: data?.subject ?? def.subject, html: data?.html ?? def.html, text: data?.text_body ?? def.text, custom: !!data };
}

export async function isEventEnabled(key: string, settings?: Record<string, unknown> | null) {
  const ev = EVENT_MAP[key];
  if (!ev) return false;
  if (key === "test_message") return true;
  if (ev.integration !== "integrated") return false;
  const legacy = LEGACY_TOGGLE[key];
  if (legacy) return !!settings?.[legacy];
  const { data } = await (await db()).from("notification_rules").select("enabled").eq("event_key", key).maybeSingle();
  return data?.enabled ?? true;
}

async function context() {
  const c = await db();
  const [{ data: s }, { data: p }] = await Promise.all([
    c.from("email_settings").select("*").eq("id", 1).maybeSingle(),
    c.from("platform_settings").select("platform_name").eq("id", 1).maybeSingle(),
  ]);
  return { s, platform: (p?.platform_name as string | undefined) || "Tata Na Baczności" };
}

export type DispatchInput = { event: string; to?: string | null; vars: Vars; idempotencyKey: string; relatedId?: string | null; forceTest?: boolean; test?: boolean };
export type DispatchResult = { status: "sent" | "simulated" | "skipped" | "failed" | "duplicate"; id?: string; reason?: string };

export async function dispatch(i: DispatchInput): Promise<DispatchResult> {
  const c = await db();
  try {
    const ev = EVENT_MAP[i.event];
    if (!ev) return { status: "failed", reason: "unknown_event" };
    const { s, platform } = await context();
    const base = { kind: i.event, related_id: i.relatedId ?? null, template_key: i.event, idempotency_key: i.idempotencyKey };
    const mode = i.forceTest || s?.delivery_mode !== "live" || !providerStatus().connected ? "test" : "live";

    const insert = async (row: Record<string, unknown>) => {
      const { data, error } = await c.from("email_notification_log").insert({ ...base, mode, ...row } as never).select("id").single();
      if (error) { if (error.code === "23505") return null; throw error; }
      return data.id as string;
    };

    if (!i.test && !(await isEventEnabled(i.event, s))) {
      const id = await insert({ status: "skipped", reason: ev.integration === "integrated" ? "notification_disabled" : "event_not_integrated", recipient: null });
      return id ? { status: "skipped", id, reason: "notification_disabled" } : { status: "duplicate" };
    }
    const to = (ev.recipient === "admin" && !i.test ? s?.notification_recipient : i.to)?.trim() ?? "";
    if (!EMAIL.test(to)) {
      const id = await insert({ status: "skipped", reason: "recipient_not_configured", recipient: to || null });
      return id ? { status: "skipped", id, reason: "recipient_not_configured" } : { status: "duplicate" };
    }
    const tpl = await loadTemplate(i.event);
    const vars: Vars = { ...i.vars, nazwa_platformy: platform };
    const payload = stripSensitive(i.vars);
    const r = render(tpl!, vars, tpl!.required);
    if (!r.ok) {
      const id = await insert({ status: "failed", reason: `missing_variables:${r.missing.join(",")}`, recipient: to, payload, retryable: true });
      return id ? { status: "failed", id, reason: "missing_variables" } : { status: "duplicate" };
    }
    const retryable = !r.usesSensitive;
    const id = await insert({ status: "sending", recipient: to, payload, retryable });
    if (!id) return { status: "duplicate" };
    return await finish(id, { to, vars, mode, retryable, attempts: 1, tpl: tpl!, s, idempotencyKey: i.idempotencyKey });
  } catch (e) {
    console.error("dispatch failed", e instanceof Error ? e.message : e);
    return { status: "failed", reason: "internal_error" };
  }
}

type FinishCtx = { to: string; vars: Vars; mode: string; retryable: boolean; attempts: number; tpl: NonNullable<Awaited<ReturnType<typeof loadTemplate>>>; s: any; idempotencyKey: string };

async function finish(id: string, f: FinishCtx): Promise<DispatchResult> {
  const c = await db();
  const now = new Date().toISOString();
  if (f.mode === "test") {
    // Captured, never delivered. Links with tokens are masked in the stored copy.
    const m = render(f.tpl, maskSensitive(f.vars), f.tpl.required);
    await c.from("email_notification_log").update({
      status: "simulated", reason: null, attempts: f.attempts, mode: "test", updated_at: now,
      rendered_subject: m.ok ? m.subject : null, rendered_html: m.ok ? m.html : null, rendered_text: m.ok ? m.text : null,
    } as never).eq("id", id);
    return { status: "simulated", id };
  }
  const r = render(f.tpl, f.vars, f.tpl.required);
  if (!r.ok) {
    await c.from("email_notification_log").update({ status: "failed", reason: `missing_variables:${r.missing.join(",")}`, attempts: f.attempts, updated_at: now } as never).eq("id", id);
    return { status: "failed", id, reason: "missing_variables" };
  }
  const from = `${f.s?.sender_name ?? "Tata Na Baczności"} <${f.s?.sender_local_part ?? "kontakt"}@${f.s?.sender_domain ?? ""}>`;
  const res = await deliver({ to: f.to, from, replyTo: f.s?.reply_to ?? null, subject: r.subject, html: r.html, text: r.text, idempotencyKey: f.idempotencyKey });
  await c.from("email_notification_log").update(res.ok
    ? { status: "sent", reason: null, provider_message_id: res.id, attempts: f.attempts, mode: "live", updated_at: now }
    : { status: "failed", reason: res.reason, attempts: f.attempts, mode: "live", updated_at: now } as never).eq("id", id);
  return res.ok ? { status: "sent", id } : { status: "failed", id, reason: res.reason };
}

// Retry a failed entry in place (same row, attempts+1). Only rows whose
// variables were safely stored (no tokenized links) can be retried.
export async function retry(id: string): Promise<DispatchResult> {
  const c = await db();
  const { data: row } = await c.from("email_notification_log").select("*").eq("id", id).maybeSingle();
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.status !== "failed") throw new Error("Ponowić można tylko wysyłkę zakończoną błędem.");
  if (!row.retryable || !row.template_key || !row.recipient) throw new Error("Tej wysyłki nie można bezpiecznie ponowić (zawierała poufny link).");
  const { data: locked } = await c.from("email_notification_log").update({ status: "sending", updated_at: new Date().toISOString() } as never)
    .eq("id", id).eq("status", "failed").select("id");
  if (!locked?.length) throw new Error("Wysyłka jest już ponawiana.");
  const { s, platform } = await context();
  const tpl = await loadTemplate(row.template_key);
  const mode = s?.delivery_mode !== "live" || !providerStatus().connected ? "test" : "live";
  const vars: Vars = { ...((row.payload as Record<string, string>) ?? {}), nazwa_platformy: platform };
  const pre = render(tpl!, vars, tpl!.required);
  if (!pre.ok) {
    await c.from("email_notification_log").update({ status: "failed", reason: `missing_variables:${pre.missing.join(",")}`, attempts: row.attempts + 1, updated_at: new Date().toISOString() } as never).eq("id", id);
    return { status: "failed", id, reason: "missing_variables" };
  }
  return finish(id, { to: row.recipient, vars, mode, retryable: true, attempts: row.attempts + 1, tpl: tpl!, s, idempotencyKey: `${row.idempotency_key}-r${row.attempts + 1}` });
}

// Legacy entry point used by Kontakt and Newsletter.
export type NotifyPayload =
  | { kind: "contact_message"; id: string; name: string; email: string; subject: string; receivedAt: string }
  | { kind: "newsletter_signup"; id: string; receivedAt: string };

export async function notifyAdmin(p: NotifyPayload): Promise<void> {
  const { s } = await context().catch(() => ({ s: null as any }));
  const base = "https://tatanabacznosci.pl/admin";
  const vars: Vars = p.kind === "contact_message"
    ? { imie: p.name, email: p.email, temat_wiadomosci: p.subject, link_do_panelu: s?.admin_inbox_url || `${base}/wiadomosci` }
    : { link_do_panelu: `${base}/subskrybenci` };
  await dispatch({ event: p.kind, vars, idempotencyKey: `${p.kind}-${p.id}`, relatedId: p.id });
}

export async function hashIp(ip: string | null | undefined): Promise<string | null> {
  if (!ip) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tnb:${ip}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
