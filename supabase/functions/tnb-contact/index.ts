import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";

const allowedOrigins = new Set([
  "https://tatanabacznosci.pl",
  "https://www.tatanabacznosci.pl",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const contactSchema = z.object({
  name: z.string().trim().min(1, "Podaj imię").max(100, "Maksymalnie 100 znaków"),
  email: z.string().trim().email("Podaj poprawny adres e-mail").max(255, "Maksymalnie 255 znaków"),
  subject: z.string().trim().min(1, "Podaj temat").max(150, "Maksymalnie 150 znaków"),
  message: z.string().trim().min(10, "Wiadomość musi mieć co najmniej 10 znaków").max(3000, "Maksymalnie 3000 znaków"),
  privacy: z.literal(true, { errorMap: () => ({ message: "Potwierdź zapoznanie się z polityką prywatności" }) }),
  website: z.string().max(0).optional().default(""),
  elapsedMs: z.number().int().nonnegative(),
}).strict();

type ContactInput = z.infer<typeof contactSchema>;

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const value = JSON.parse(raw);
      if (typeof value === "string") return value;
      if (value && typeof value.default === "string") return value.default;
      continue;
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
    if ((apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + apiKey) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secret = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) {
    console.error("TNB contact function runtime configuration is incomplete");
    throw new ApiError("Usługa jest chwilowo niedostępna.", 503, "backend_not_configured");
  }
  return createClient(url, secret, {
    global: { fetch: createSupabaseFetch(secret) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function cors(origin: string | null): Headers {
  const headers = new Headers(supabaseCorsHeaders);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  headers.delete("Access-Control-Allow-Origin");
  if (origin && allowedOrigins.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]!);

function layout(inner: string, platform: string): string {
  const styled = inner
    .replace(/<h1>/g, '<h1 style="margin:0 0 20px;font-family:Georgia,\'Times New Roman\',serif;font-size:26px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#f3ead7;">')
    .replace(/<p>/g, '<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#d9d2c3;">')
    .replace(/<a class="btn" /g, '<a style="display:inline-block;margin-top:8px;padding:12px 22px;background:#c9a24a;color:#14110d;text-decoration:none;font-weight:600;letter-spacing:1px;text-transform:uppercase;font-size:13px;" ');
  const safePlatform = escapeHtml(platform);
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safePlatform}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#14110d;border-top:3px solid #c9a24a;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="padding:24px 28px 0;font-family:Georgia,serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#c9a24a;">${safePlatform}</td></tr>
<tr><td style="padding:20px 28px 28px;">${styled}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #3a3226;font-size:12px;color:#8f877a;">Wiadomość wysłana automatycznie przez ${safePlatform}.</td></tr>
</table></td></tr></table></body></html>`;
}

type ContactTemplate = { subject: string; html: string; text: string };
const DEFAULT_TEMPLATE: ContactTemplate = {
  subject: "Nowa wiadomość: {{temat_wiadomosci}}",
  html: '<h1>Nowa wiadomość z Kontaktu</h1><p>Od: {{imie}} ({{email}})</p><p>Temat: {{temat_wiadomosci}}</p><p><a class="btn" href="{{link_do_panelu}}">Otwórz skrzynkę</a></p>',
  text: 'Nowa wiadomość z Kontaktu\n\nOd: {{imie}} ({{email}})\nTemat: {{temat_wiadomosci}}\n\nOtwórz skrzynkę: {{link_do_panelu}}\n\n— {{nazwa_platformy}}',
};

function renderContactTemplate(template: ContactTemplate, vars: Record<string, string>): { subject: string; html: string; text: string; missing: string[] } {
  const combined = `${template.subject}\n${template.html}\n${template.text}`;
  const used = Array.from(new Set(Array.from(combined.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g), (m) => m[1]!)));
  const required = ["imie", "email", "temat_wiadomosci", "link_do_panelu"];
  const missing = Array.from(new Set([...used, ...required])).filter((key) => {
    const value = vars[key]?.trim();
    if (!value) return true;
    if (key === "link_do_panelu" && !/^https?:\/\/[^\s"<>]+$/i.test(value)) return true;
    return false;
  });
  const replace = (source: string, html: boolean) => source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key] ?? "";
    return html ? escapeHtml(value) : value;
  });
  return {
    subject: replace(template.subject, false).replace(/[\r\n]+/g, " "),
    html: layout(replace(template.html, true), vars.nazwa_platformy ?? "Tata Na Baczności"),
    text: replace(template.text, false),
    missing,
  };
}

async function recordContactNotification(db: ReturnType<typeof createAdminClient>, message: {
  id: string; name: string; email: string; subject: string;
}) {
  const { data: settings } = await db.from("email_settings")
    .select("notification_recipient, contact_notifications_enabled, admin_inbox_url, sender_name, sender_local_part, sender_domain, reply_to, delivery_mode")
    .eq("id", 1).maybeSingle();
  const { data: platformSettings } = await db.from("platform_settings")
    .select("platform_name").eq("id", 1).maybeSingle();
  const platform = platformSettings?.platform_name || "Tata Na Baczności";
  const inbox = settings?.admin_inbox_url || "https://tatanabacznosci.pl/admin/wiadomosci";
  const vars = {
    imie: message.name,
    email: message.email,
    temat_wiadomosci: message.subject,
    link_do_panelu: inbox,
    nazwa_platformy: platform,
  };
  const base = {
    kind: "contact_message",
    related_id: message.id,
    template_key: "contact_message",
    idempotency_key: `contact_message-${message.id}`,
    mode: "test",
  };
  let recipient: string | null = null;
  let status: "skipped" | "sending" | "failed" = "skipped";
  let reason: string | null = null;
  let payload: Record<string, string> | null = null;
  let rendered: ReturnType<typeof renderContactTemplate> | null = null;

  if (!settings?.contact_notifications_enabled) {
    reason = "notification_disabled";
  } else {
    const to = (settings.notification_recipient ?? "").trim();
    recipient = to || null;
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(to)) {
      reason = "recipient_not_configured";
    } else {
      const { data: custom } = await db.from("email_templates")
        .select("subject, html, text_body").eq("key", "contact_message").maybeSingle();
      const template = custom
        ? { subject: custom.subject, html: custom.html, text: custom.text_body }
        : DEFAULT_TEMPLATE;
      rendered = renderContactTemplate(template, vars);
      payload = { imie: vars.imie, email: vars.email, temat_wiadomosci: vars.temat_wiadomosci, link_do_panelu: vars.link_do_panelu };
      if (rendered.missing.length) {
        status = "failed";
        reason = `missing_variables:${rendered.missing.join(",")}`;
      } else {
        status = "sending";
      }
    }
  }

  const { data: log, error: insertError } = await db.from("email_notification_log").insert({
    ...base,
    status,
    reason,
    recipient,
    payload,
    retryable: recipient !== null,
    ...(status === "failed" && rendered ? {
      rendered_subject: null,
      rendered_html: null,
      rendered_text: null,
    } : {}),
  }).select("id").single();

  if (insertError) {
    if (insertError.code === "23505") return;
    throw insertError;
  }
  if (status !== "sending" || !log?.id || !rendered) return;

  if (mode === "test") {
    const { error: updateError } = await db.from("email_notification_log").update({
      status: "simulated", reason: null, attempts: 1, mode: "test",
      rendered_subject: rendered.subject, rendered_html: rendered.html, rendered_text: rendered.text,
      updated_at: new Date().toISOString(),
    }).eq("id", log.id);
    if (updateError) throw updateError;
    return;
  }
  const from = `${settings?.sender_name ?? "Tata Na Baczności"} <${settings?.sender_local_part ?? "kontakt"}@${settings?.sender_domain ?? "tatanabacznosci.pl"}>`;
  try {
    const sent = await sendSmtpMail({ to: recipient!, from, replyTo: settings?.reply_to ?? null, subject: rendered.subject, html: rendered.html, text: rendered.text });
    const { error: updateError } = await db.from("email_notification_log").update({
      status: "sent", reason: null, attempts: 1, mode: "live", provider_message_id: sent.messageId, updated_at: new Date().toISOString(),
    }).eq("id", log.id);
    if (updateError) throw updateError;
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 300) : "smtp_delivery_failed";
    await db.from("email_notification_log").update({ status: "failed", reason, attempts: 1, mode: "live", updated_at: new Date().toISOString() }).eq("id", log.id);
    throw error;
  }
}

async function handleSubmit(data: ContactInput) {
  if (data.website || data.elapsedMs < 2500) {
    throw new ApiError("Wiadomość odrzucona przez filtr antyspamowy.", 400, "spam_rejected");
  }
  const db = createAdminClient();
  const { data: row, error } = await db.from("contact_messages").insert({
    name: data.name,
    email: data.email,
    subject: data.subject,
    message: data.message,
    privacy_accepted: true,
  }).select("id,created_at").single();

  if (error || !row) {
    console.error("contact insert failed", error?.message);
    throw new ApiError("Nie udało się zapisać wiadomości.", 500, "insert_failed");
  }

  try {
    await recordContactNotification(db, { id: row.id, name: data.name, email: data.email, subject: data.subject });
  } catch (error) {
    console.error("contact notification logging failed", error instanceof Error ? error.message : error);
  }

  return { ok: true as const };
}

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) {
    return Response.json({ error: "origin_not_allowed", message: "Niedozwolone źródło żądania." }, { status: 403, headers });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed", message: "Dozwolona jest metoda POST." }, { status: 405, headers });
  }

  try {
    let raw: unknown;
    try { raw = await req.json(); } catch { throw new ApiError("Nieprawidłowe dane żądania.", 400, "invalid_json"); }
    const parsed = contactSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Nieprawidłowe dane formularza.", 400, "validation_error");
    }
    const result = await handleSubmit(parsed.data);
    return Response.json(result, { status: 200, headers });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status, headers });
    }
    console.error("tnb-contact failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "internal_error", message: "Nie udało się wysłać wiadomości." }, { status: 500, headers });
  }
});
