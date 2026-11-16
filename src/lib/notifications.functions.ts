import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertSuperadmin, logEvent } from "./admin-auth.server";
import { DEFAULT_TEMPLATES, EVENTS, sampleVars } from "./notify/registry";
import { render, maskSensitive } from "./notify/render";

const isSuper = async (ctx: { supabase: any; userId: string }) =>
  !!(await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "superadmin" })).data;

export const getNotificationOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { providerStatus, isEventEnabled } = await import("./notifications.server");
    const [{ data: s }, { data: tpls }] = await Promise.all([
      context.supabase.from("email_settings").select("*").eq("id", 1).maybeSingle(),
      context.supabase.from("email_templates").select("key, updated_at"),
    ]);
    const custom = new Map((tpls ?? []).map((t: { key: string; updated_at: string }) => [t.key, t.updated_at]));
    const events = await Promise.all(EVENTS.map(async (e) => ({ ...e, enabled: await isEventEnabled(e.key, s), customized: custom.has(e.key) })));
    const p = providerStatus();
    return {
      canEdit: await isSuper(context),
      provider: { name: "Lovable — wbudowana poczta", connected: p.connected, domainStatus: p.connected ? "verified" : "pending" },
      settings: { sender: `${s?.sender_local_part ?? "kontakt"}@${s?.sender_domain ?? "—"}`, sender_name: s?.sender_name ?? "", reply_to: s?.reply_to ?? null, delivery_mode: (s?.delivery_mode ?? "test") as "test" | "live", recipient: s?.notification_recipient ?? null },
      events,
    };
  });

export const getTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { loadTemplate } = await import("./notifications.server");
    const t = await loadTemplate(data.key);
    if (!t) throw new Error("Nie ma takiego szablonu.");
    return t;
  });

const tplSchema = z.object({ key: z.string().max(64), subject: z.string().trim().min(1, "Podaj temat").max(200), html: z.string().min(1, "Podaj treść HTML").max(20000), text: z.string().min(1, "Podaj wersję tekstową").max(10000) });

export const previewTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tplSchema.extend({ vars: z.record(z.string(), z.string().max(500)).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const def = DEFAULT_TEMPLATES[data.key];
    if (!def) throw new Error("Nie ma takiego szablonu.");
    const r = render(data, maskSensitive({ ...sampleVars(), ...(data.vars ?? {}) }), def.required);
    return r;
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tplSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, `template:${data.key}`);
    const def = DEFAULT_TEMPLATES[data.key];
    if (!def) throw new Error("Nie ma takiego szablonu.");
    const check = render(data, sampleVars(), def.required);
    if (!check.ok) throw new Error(`Szablon zawiera nieznane lub brakujące zmienne: ${check.missing.join(", ")}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("email_templates").upsert({ key: data.key, subject: data.subject, html: data.html, text_body: data.text, updated_at: new Date().toISOString(), updated_by: context.userId });
    if (error) { await logEvent({ type: "template_update", actor: context.userId, objectKind: "template", objectId: data.key, result: "failed" }); throw new Error("Nie udało się zapisać szablonu."); }
    await logEvent({ type: "template_update", actor: context.userId, objectKind: "template", objectId: data.key });
    return { ok: true as const };
  });

export const resetTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, `template:${data.key}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("email_templates").delete().eq("key", data.key);
    await logEvent({ type: "template_reset", actor: context.userId, objectKind: "template", objectId: data.key });
    return { ok: true as const };
  });

export const setEventEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(64), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, `rule:${data.key}`);
    const ev = EVENTS.find((e) => e.key === data.key);
    if (!ev || ev.integration !== "integrated" || ev.key === "test_message") throw new Error("To zdarzenie nie jest jeszcze zintegrowane — nie można go włączyć.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const legacy = { contact_message: "contact_notifications_enabled", newsletter_signup: "newsletter_notifications_enabled" }[data.key as string];
    const { error } = legacy
      ? await supabaseAdmin.from("email_settings").update({ [legacy]: data.enabled, updated_at: new Date().toISOString() } as never).eq("id", 1)
      : await supabaseAdmin.from("notification_rules").upsert({ event_key: data.key, enabled: data.enabled, updated_at: new Date().toISOString(), updated_by: context.userId });
    if (error) throw new Error("Nie udało się zapisać reguły.");
    await logEvent({ type: data.enabled ? "rule_enabled" : "rule_disabled", actor: context.userId, objectKind: "rule", objectId: data.key });
    return { ok: true as const };
  });

export const updateDeliveryConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    reply_to: z.union([z.string().trim().email("Podaj poprawny adres odpowiedzi").max(255), z.literal("")]).transform((v) => v || null),
    delivery_mode: z.enum(["test", "live"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, "email_provider");
    const { providerStatus } = await import("./notifications.server");
    if (data.delivery_mode === "live" && !providerStatus().connected)
      throw new Error("Rzeczywistej wysyłki nie można włączyć: domena nadawcy oczekuje na weryfikację.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("email_settings").update({ ...data, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw new Error("Nie udało się zapisać konfiguracji.");
    await logEvent({ type: "settings_update", actor: context.userId, objectKind: "settings", objectId: "email_provider" });
    return { ok: true as const };
  });

export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(64), to: z.string().trim().email("Podaj poprawny adres e-mail").max(255), vars: z.record(z.string(), z.string().max(500)).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, "email_test");
    if (!DEFAULT_TEMPLATES[data.key]) throw new Error("Nie ma takiego szablonu.");
    const { dispatchTemplateTest } = await import("./notifications-test.server");
    const r = await dispatchTemplateTest(data.key, data.to, { ...sampleVars(), ...(data.vars ?? {}) });
    await logEvent({ type: "email_test", actor: context.userId, objectKind: "template", objectId: data.key, result: r.status === "failed" ? "failed" : "ok" });
    return r;
  });

export const runDuplicateCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context, "email_test");
    const { dispatch } = await import("./notifications.server");
    const key = `dup-check-${crypto.randomUUID()}`;
    const { data: me } = await context.supabase.auth.getUser();
    const input = { event: "test_message", to: me.user?.email ?? "", vars: { imie: "Test" }, idempotencyKey: key, forceTest: true };
    const first = await dispatch(input);
    const second = await dispatch(input);
    return { first: first.status, second: second.status };
  });

export const retryNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, "email_retry");
    const { retry } = await import("./notifications.server");
    const r = await retry(data.id);
    await logEvent({ type: "email_retry", actor: context.userId, objectKind: "notification", objectId: data.id, result: r.status === "failed" ? "failed" : "ok" });
    return r;
  });

export const getLogPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase.from("email_notification_log")
      .select("rendered_subject, rendered_html, rendered_text, mode").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Nie znaleziono podglądu.");
    return row as { rendered_subject: string | null; rendered_html: string | null; rendered_text: string | null; mode: string };
  });
