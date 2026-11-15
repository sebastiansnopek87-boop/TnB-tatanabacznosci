import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";

const allowedOrigins = new Set([
  "https://tatanabacznosci.pl",
  "https://www.tatanabacznosci.pl",
  "http://localhost:5173",
]);
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
const Input = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(10).max(3000),
  privacy: z.literal(true),
  website: z.string().max(0).optional().default(""),
  elapsedMs: z.number().int().min(2500),
});

function cors(origin: string | null) {
  const h = new Headers(supabaseCorsHeaders);
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Max-Age", "86400");
  h.set("Vary", "Origin");
  h.delete("Access-Control-Allow-Origin");
  if (origin && allowedOrigins.has(origin)) h.set("Access-Control-Allow-Origin", origin);
  return h;
}
function envKey(...names: string[]): string | null {
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
function createSupabaseFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if ((apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + apiKey) headers.delete("Authorization");
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}
function admin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Backend unavailable");
  return createClient(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
function json(data: unknown, status: number, headers: Headers) {
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers });
}
function validEmail(value: string | null | undefined): value is string {
  return !!value && EMAIL.test(value.trim());
}

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed", message: "Niedozwolona metoda." }, 405, headers);

  try {
    const raw = await req.json().catch(() => null);
    const parsed = Input.safeParse(raw);
    if (!parsed.success) return json({ error: "invalid_input", message: "Sprawdź poprawność formularza." }, 400, headers);
    const data = parsed.data;
    if (data.website || data.elapsedMs < 2500) return json({ error: "spam_rejected", message: "Wiadomość odrzucona przez filtr antyspamowy." }, 400, headers);

    const db = admin();
    const { data: row, error } = await db.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      privacy_accepted: true,
    }).select("id,created_at").single();
    if (error || !row) {
      console.error("contact insert failed", error?.message);
      return json({ error: "save_failed", message: "Nie udało się zapisać wiadomości." }, 500, headers);
    }

    // The original notification provider is intentionally in test mode until a sender is connected.
    const [{ data: settings }, { data: platform }] = await Promise.all([
      db.from("email_settings").select("notification_recipient,admin_inbox_url,contact_notifications_enabled").eq("id", 1).maybeSingle(),
      db.from("platform_settings").select("platform_name").eq("id", 1).maybeSingle(),
    ]);
    const enabled = settings?.contact_notifications_enabled !== false;
    const recipient = settings?.notification_recipient?.trim() ?? null;
    const vars = {
      imie: data.name,
      email: data.email,
      temat_wiadomosci: data.subject,
      link_do_panelu: settings?.admin_inbox_url || "https://tatanabacznosci.pl/admin/wiadomosci",
      nazwa_platformy: platform?.platform_name || "Tata Na Baczności",
    };
    const status = !enabled ? "skipped" : validEmail(recipient) ? "simulated" : "skipped";
    const reason = !enabled ? "notification_disabled" : validEmail(recipient) ? null : "recipient_not_configured";
    const { error: logError } = await db.from("email_notification_log").insert({
      kind: "contact_message",
      related_id: row.id,
      template_key: "contact_message",
      idempotency_key: `contact_message-${row.id}`,
      recipient: enabled && validEmail(recipient) ? recipient : null,
      mode: "test",
      status,
      reason,
      payload: vars,
      attempts: 0,
      retryable: false,
    });
    if (logError && logError.code !== "23505") console.error("contact notification log failed", logError.message);

    return json({ ok: true }, 200, headers);
  } catch {
    return json({ error: "internal_error", message: "Nie udało się wysłać wiadomości." }, 500, headers);
  }
});
