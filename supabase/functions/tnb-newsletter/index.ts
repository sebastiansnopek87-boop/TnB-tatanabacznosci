import { createClient } from "@supabase/supabase-js";
import { corsHeaders as sdkCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "zod";
import { DEFAULT_TEMPLATES, EVENT_MAP } from "./registry.ts";
import { render, maskSensitive, stripSensitive, type Vars } from "./render.ts";
import { sendSmtpMail, smtpConfig } from "../_shared/smtp.ts";

const CORS = new Headers({
  ...sdkCorsHeaders,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
  "X-Content-Type-Options": "nosniff",
});
const CONSENT_VERSION = "2026-09-28";
const CONSENT_TEXT = "Wyrażam zgodę na otrzymywanie newslettera Tata Na Baczności na podany adres e-mail. Zgodę mogę wycofać w każdej chwili.";
const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail").max(255, "Adres jest za długi"),
  consent: z.boolean().refine((value) => value, "Zaznacz zgodę na otrzymywanie newslettera"),
  website: z.string().max(0).optional().default(""),
  elapsedMs: z.number().int().nonnegative(),
});
const unsubscribeSchema = z.union([
  z.object({ token: z.string().uuid() }),
  z.object({
    email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail").max(255),
    website: z.string().max(0).optional().default(""),
  }),
]);
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("subscribe"), data: subscribeSchema }),
  z.object({ action: z.literal("unsubscribe"), data: unsubscribeSchema }),
]);

function secret(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const value = JSON.parse(raw);
      if (typeof value === "string") return value;
      if (value && typeof value.default === "string") return value.default;
    } catch { return raw; }
  }
  return null;
}
function supabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = secret("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Backend newslettera nie jest skonfigurowany.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
type Db = ReturnType<typeof supabaseClient>;
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: CORS }); }
async function hashIp(ip: string | null | undefined) {
  if (!ip) return null;
  const value = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("tnb:" + ip));
  return Array.from(new Uint8Array(value)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function notifyAdmin(db: Db, id: string, now: string) {
  try {
    const def = EVENT_MAP["newsletter_signup"];
    if (!def || def.integration !== "integrated") return;
    const [{ data: settings }, { data: platform }] = await Promise.all([
      db.from("email_settings").select("*").eq("id", 1).maybeSingle(),
      db.from("platform_settings").select("platform_name").eq("id", 1).maybeSingle(),
    ]);
    if (settings?.newsletter_notifications_enabled === false) return;
    const { data: rule } = await db.from("notification_rules").select("enabled").eq("event_key", "newsletter_signup").maybeSingle();
    if (rule?.enabled === false) return;
    const to = settings?.notification_recipient;
    if (typeof to !== "string" || !/^[^\s@<>"]+@[^\s@<>]+\.[a-z]{2,}$/i.test(to)) return;
    const template = DEFAULT_TEMPLATES["newsletter_signup"];
    if (!template) return;
    const vars: Vars = { link_do_panelu: settings?.admin_inbox_url || "https://tatanabacznosci.pl/admin/subskrybenci", nazwa_platformy: platform?.platform_name || "Tata Na Baczności" };
    const rendered = render(template, vars, template.required);
    if (!rendered.ok) return;
    const { data: log, error } = await db.from("email_notification_log").insert({
      kind: "newsletter_signup", related_id: id, template_key: "newsletter_signup",
      idempotency_key: "newsletter_signup-" + id, mode, recipient: to,
      payload: stripSensitive(vars), retryable: !rendered.usesSensitive, status: "sending",
    }).select("id").single();
    if (error) {
      if (error.code !== "23505") console.error("newsletter notification log", error.message);
      return;
    }
    if (mode === "test") {
      const safe = render(template, maskSensitive(vars), template.required);
      await db.from("email_notification_log").update({
        status: "simulated", mode: "test", attempts: 1, reason: null, updated_at: now,
        rendered_subject: safe.ok ? safe.subject : null,
        rendered_html: safe.ok ? safe.html : null,
        rendered_text: safe.ok ? safe.text : null,
      }).eq("id", log.id);
      return;
    }
    const from = `${settings?.sender_name ?? "Tata Na Baczności"} <${settings?.sender_local_part ?? "kontakt"}@${settings?.sender_domain ?? "tatanabacznosci.pl"}>`;
    try {
      const sent = await sendSmtpMail({ to, from, replyTo: settings?.reply_to ?? null, subject: rendered.subject, html: rendered.html, text: rendered.text });
      await db.from("email_notification_log").update({ status: "sent", mode: "live", attempts: 1, reason: null, provider_message_id: sent.messageId, updated_at: now }).eq("id", log.id);
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 300) : "smtp_delivery_failed";
      await db.from("email_notification_log").update({ status: "failed", mode: "live", attempts: 1, reason, updated_at: now }).eq("id", log.id);
    }
  } catch (error) { console.error("newsletter admin notification", error); }
}

async function subscribe(db: Db, req: Request, data: z.infer<typeof subscribeSchema>) {
  if (data.website || data.elapsedMs < 1500) throw new Error("Zapis odrzucony przez filtr antyspamowy.");
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipHash = await hashIp(ip);
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300);
  if (ipHash) {
    const since = new Date(Date.now() - 3600000).toISOString();
    const { count } = await db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("updated_at", since);
    if ((count ?? 0) >= 5) throw new Error("Zbyt wiele prób. Spróbuj ponownie później.");
  }
  const { data: settings } = await db.from("email_settings").select("newsletter_double_opt_in").eq("id", 1).maybeSingle();
  const double = !!settings?.newsletter_double_opt_in;
  const now = new Date().toISOString();
  const status = double ? "pending" : "active";
  const consent = {
    consent_text: CONSENT_TEXT, consent_version: CONSENT_VERSION, consent_given_at: now,
    opt_in_method: double ? "double" : "single", ip_hash: ipHash, user_agent: ua, updated_at: now,
  };
  const { data: existing } = await db.from("newsletter_subscribers")
    .select("id,status,subscribe_count").ilike("email", data.email).maybeSingle();
  if (existing?.status === "active") return { status: "already" as const };
  let id: string;
  if (existing) {
    const { error } = await db.from("newsletter_subscribers").update({
      ...consent, status, unsubscribed_at: null, confirmed_at: double ? null : now,
      confirm_token: crypto.randomUUID(), subscribe_count: existing.subscribe_count + 1,
    }).eq("id", existing.id);
    if (error) { console.error("newsletter update", error.message); throw new Error("Nie udało się zapisać adresu."); }
    id = existing.id;
  } else {
    const { data: row, error } = await db.from("newsletter_subscribers").insert({
      ...consent, email: data.email, status, source: "homepage", confirmed_at: double ? null : now,
      confirm_token: crypto.randomUUID(),
    }).select("id").single();
    if (error || !row) { console.error("newsletter insert", error?.message); throw new Error("Nie udało się zapisać adresu."); }
    id = row.id;
  }
  await notifyAdmin(db, id, now);
  return { status: double ? "pending" as const : existing ? "resubscribed" as const : "subscribed" as const };
}
async function unsubscribe(db: Db, data: z.infer<typeof unsubscribeSchema>) {
  if ("website" in data && data.website) throw new Error("Odrzucono.");
  const now = new Date().toISOString();
  let query = db.from("newsletter_subscribers").update({ status: "unsubscribed", unsubscribed_at: now, updated_at: now }).neq("status", "unsubscribed");
  const { error } = "token" in data ? await query.eq("unsubscribe_token", data.token) : await query.ilike("email", data.email);
  if (error) { console.error("unsubscribe", error.message); throw new Error("Nie udało się wypisać adresu."); }
  return { ok: true as const };
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ message: "Niedozwolona metoda." }, 405);
  try {
    const parsed = actionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ message: "Nieprawidłowe żądanie." }, 400);
    const db = supabaseClient();
    if (parsed.data.action === "subscribe") return json(await subscribe(db, req, parsed.data.data));
    return json(await unsubscribe(db, parsed.data.data));
  } catch (error) {
    const status = error instanceof Error && error.message === "Zapis odrzucony przez filtr antyspamowy." ? 400 : 400;
    const message = error instanceof Error ? error.message : "Wystąpił błąd serwera.";
    return json({ message }, status);
  }
});
