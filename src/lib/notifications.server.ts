// Server-only admin notifications. Real delivery requires a verified sender
// domain + recipient in email_settings; until then every attempt is logged as
// "skipped" with the reason — never reported as sent.
type Kind = "contact_message" | "newsletter_signup";

export type NotifyPayload =
  | { kind: "contact_message"; id: string; name: string; email: string; subject: string; receivedAt: string }
  | { kind: "newsletter_signup"; id: string; receivedAt: string };

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function log(kind: Kind, relatedId: string, status: "sent" | "skipped" | "failed" | "suppressed", reason: string | null, recipient: string | null) {
  const db = await admin();
  await db.from("email_notification_log").insert({ kind, related_id: relatedId, status, reason, recipient });
}

export async function notifyAdmin(p: NotifyPayload): Promise<void> {
  try {
    const db = await admin();
    const { data: s } = await db.from("email_settings").select("*").eq("id", 1).maybeSingle();
    const enabled = p.kind === "contact_message" ? s?.contact_notifications_enabled : s?.newsletter_notifications_enabled;
    if (!s || !enabled) return log(p.kind, p.id, "skipped", "notification_disabled", null);
    if (!s.notification_recipient) return log(p.kind, p.id, "skipped", "recipient_not_configured", null);
    if (!s.sender_domain) return log(p.kind, p.id, "skipped", "sender_domain_not_configured", s.notification_recipient);
    // Sender domain is set but the delivery templates are wired in the next step.
    return log(p.kind, p.id, "skipped", "sender_not_connected", s.notification_recipient);
  } catch (e) {
    console.error("notifyAdmin failed", e instanceof Error ? e.message : e);
    try { await log(p.kind, p.id, "failed", "internal_error", null); } catch { /* ignore */ }
  }
}

export async function hashIp(ip: string | null | undefined): Promise<string | null> {
  if (!ip) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tnb:${ip}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
