// Admin configuration of payment operators. Read: admin. Changes: superadmin.
// Secrets live only in server env (never returned); the panel shows only whether they are set.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertSuperadmin, logEvent } from "./admin-auth.server";

const ID = z.enum(["p24", "tpay", "payu"]);
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

export const listPaymentProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { REQUIREMENTS, configStatus } = await import("./payments/providers.server");
    const { siteOrigin } = await import("./orders.server");
    const { data } = await (await admin()).from("payment_providers").select("*").order("id");
    const { data: sup } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" });
    return {
      canEdit: !!sup,
      providers: (data ?? []).map((p: any) => {
        const r = REQUIREMENTS[p.id as "p24"];
        return { ...p, label: r.label, fields: r.fields, docs: r.docs, refunds: r.refunds, webhookUrl: `${siteOrigin()}/api/public/payments/${p.id}`, status: configStatus(p) };
      }),
    };
  });

export const updatePaymentProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: ID,
    enabled: z.boolean(),
    isDefault: z.boolean(),
    merchant_id: z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/, "Dozwolone litery, cyfry, - i _."),
    pos_id: z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/, "Dozwolone litery, cyfry, - i _."),
    client_id: z.string().trim().max(120).regex(/^[A-Za-z0-9_.-]*$/, "Nieprawidłowe znaki w Client ID."),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, `payment_${data.id}`);
    const { ADAPTERS, configStatus } = await import("./payments/providers.server");
    const s = await admin();
    const { data: cur } = await s.from("payment_providers").select("*").eq("id", data.id).single();
    const next = { ...cur, merchant_id: data.merchant_id || null, pos_id: data.pos_id || null, client_id: data.client_id || null };
    if (data.enabled && !configStatus(next as any).configured) throw new Error("Nie można włączyć operatora bez kompletnej konfiguracji.");
    if (data.isDefault && !data.enabled) throw new Error("Operator domyślny musi być włączony.");
    // Enabling a LIVE operator requires a fresh, successful connection test against
    // the production endpoint BEFORE any activation write or default-operator change.
    let liveTest: { ok: boolean; detail: string } | null = null;
    if (data.enabled && cur?.environment === "live") {
      liveTest = await ADAPTERS[data.id].test(next as any).catch(() => ({ ok: false, detail: "Brak odpowiedzi od operatora." }));
      if (!liveTest.ok) throw new Error(`Nie można włączyć operatora w trybie produkcyjnym: ${liveTest.detail}`);
    }
    // Changed identifiers invalidate any earlier test result unless a fresh test just passed.
    const idsChanged = next.merchant_id !== cur?.merchant_id || next.pos_id !== cur?.pos_id || next.client_id !== cur?.client_id;
    const testFields = liveTest
      ? { last_test_at: new Date().toISOString(), last_test_ok: liveTest.ok, last_test_detail: liveTest.detail }
      : idsChanged ? { last_test_at: null, last_test_ok: null, last_test_detail: null } : {};
    if (data.isDefault) await s.from("payment_providers").update({ is_default: false }).neq("id", data.id);
    const { error } = await s.from("payment_providers").update({ enabled: data.enabled, is_default: data.isDefault, merchant_id: next.merchant_id, pos_id: next.pos_id, client_id: next.client_id, ...testFields, updated_at: new Date().toISOString(), updated_by: context.userId }).eq("id", data.id);
    if (error) throw new Error("Nie udało się zapisać konfiguracji.");
    await logEvent({ type: "payment_config", actor: context.userId, objectKind: "payment", objectId: data.id, detail: `${data.enabled ? "włączony" : "wyłączony"}${data.isDefault ? ", domyślny" : ""}` });
    return { ok: true };
  });

// Switching to production requires superadmin + typed confirmation; back to test is always allowed.
export const setPaymentEnvironment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: ID, environment: z.enum(["sandbox", "live"]), confirm: z.string().max(40).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, `payment_env_${data.id}`);
    if (data.environment === "live" && data.confirm !== "URUCHAMIAM PRODUKCJĘ") throw new Error("Aby włączyć środowisko produkcyjne, wpisz: URUCHAMIAM PRODUKCJĘ");
    const s = await admin();
    if (data.environment === "live") {
      const { configStatus } = await import("./payments/providers.server");
      const { data: cur } = await s.from("payment_providers").select("*").eq("id", data.id).maybeSingle();
      if (!cur || !configStatus(cur as any).configured) throw new Error("Nie można uruchomić produkcji bez kompletnej konfiguracji.");
      if (!cur.last_test_ok) throw new Error("Najpierw wykonaj udany test połączenia.");
    }
    const { error } = await s.from("payment_providers").update({ environment: data.environment, last_test_at: null, last_test_ok: null, last_test_detail: null, updated_at: new Date().toISOString(), updated_by: context.userId }).eq("id", data.id);
    if (error) throw new Error("Nie udało się zmienić środowiska.");
    await logEvent({ type: data.environment === "live" ? "payment_live_on" : "payment_live_off", actor: context.userId, objectKind: "payment", objectId: data.id });
    return { ok: true };
  });

export const testPaymentProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: ID }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { ADAPTERS, configStatus } = await import("./payments/providers.server");
    const s = await admin();
    const { data: p } = await s.from("payment_providers").select("*").eq("id", data.id).single();
    const st = configStatus(p as any);
    const r = !st.configured ? { ok: false, detail: `Brak danych: ${st.missing.join(", ")}.` }
      : await ADAPTERS[data.id].test(p as any).catch(() => ({ ok: false, detail: "Brak odpowiedzi od operatora." }));
    await s.from("payment_providers").update({ last_test_at: new Date().toISOString(), last_test_ok: r.ok, last_test_detail: r.detail }).eq("id", data.id);
    await logEvent({ type: "payment_test", actor: context.userId, objectKind: "payment", objectId: data.id, result: r.ok ? "ok" : "failed", detail: r.detail });
    return r;
  });
