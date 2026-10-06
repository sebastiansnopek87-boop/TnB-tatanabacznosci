import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertSuperadmin, logEvent } from "./admin-auth.server";

export type PublicPlatformSettings = {
  platform_name: string; contact_email: string | null; support_email: string | null;
  notice_enabled: boolean; maintenance_enabled: boolean; maintenance_message: string;
  social_youtube: string | null; social_spotify: string | null; social_tiktok: string | null; social_instagram: string | null;
  podcast_layout?: string;
};
const PUBLIC_COLS = "platform_name, contact_email, support_email, notice_enabled, maintenance_enabled, maintenance_message, social_youtube, social_spotify, social_tiktok, social_instagram, podcast_layout";

// Public: only non-sensitive columns, read through the anon SELECT policy.
export const getPublicPlatformSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const db = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
      h.set("apikey", key);
      return fetch(input, { ...init, headers: h });
    } },
  });
  const { data } = await db.from("platform_settings").select(PUBLIC_COLS).eq("id", 1).maybeSingle();
  return (data ?? null) as PublicPlatformSettings | null;
});

async function isSuper(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "superadmin" });
  return !!data;
}

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("platform_settings").select(`${PUBLIC_COLS}, updated_at`).eq("id", 1).maybeSingle();
    if (error || !data) throw new Error("Nie udało się pobrać ustawień platformy.");
    const { data: email } = await context.supabase.from("email_settings")
      .select("notification_recipient, sender_name, sender_local_part, sender_domain, contact_notifications_enabled, newsletter_notifications_enabled, newsletter_double_opt_in").eq("id", 1).maybeSingle();
    return { settings: data as PublicPlatformSettings & { updated_at: string }, email, canEdit: await isSuper(context) };
  });

const optEmail = z.union([z.string().trim().email("Podaj poprawny adres e-mail").max(255), z.literal("")]).transform((v) => (v === "" ? null : v));
const optUrl = z.union([z.string().trim().url("Podaj pełny adres zaczynający się od https://").max(500).refine((v) => v.startsWith("https://"), "Adres musi zaczynać się od https://"), z.literal("")]).transform((v) => (v === "" ? null : v));
export const platformSchema = z.object({
  social_youtube: optUrl, social_spotify: optUrl, social_tiktok: optUrl, social_instagram: optUrl,
  platform_name: z.string().trim().min(1, "Podaj nazwę platformy").max(100),
  contact_email: optEmail,
  support_email: optEmail,
  notice_enabled: z.boolean(),
  maintenance_enabled: z.boolean(),
  maintenance_message: z.string().trim().max(500, "Komunikat może mieć najwyżej 500 znaków"),
}).refine((d) => !(d.notice_enabled || d.maintenance_enabled) || d.maintenance_message.length > 0, {
  message: "Wpisz treść komunikatu, zanim go włączysz.", path: ["maintenance_message"],
});

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => platformSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, "platform_settings");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin.from("platform_settings").select(PUBLIC_COLS).eq("id", 1).single();
    const { error } = await supabaseAdmin.from("platform_settings")
      .update({ ...data, updated_at: new Date().toISOString(), updated_by: context.userId }).eq("id", 1);
    if (error) {
      await logEvent({ type: "settings_update", actor: context.userId, objectKind: "settings", objectId: "platform", result: "failed" });
      throw new Error("Nie udało się zapisać ustawień.");
    }
    const changed = prev ? (Object.keys(data) as Array<keyof typeof data>).filter((k) => prev[k] !== data[k]) : [];
    // Log field names only — never values.
    await logEvent({ type: "settings_update", actor: context.userId, objectKind: "settings", objectId: "platform", detail: changed.length ? `Zmienione pola: ${changed.join(", ")}` : "Bez zmian" });
    if (prev && prev.maintenance_enabled !== data.maintenance_enabled) {
      await logEvent({ type: data.maintenance_enabled ? "maintenance_on" : "maintenance_off", actor: context.userId, objectKind: "settings", objectId: "maintenance" });
    }
    return { ok: true as const };
  });

export type PodcastLayout = "list" | "grid";

// Public: layout of the episode list on /podcast.
export const getPodcastLayout = createServerFn({ method: "GET" }).handler(async () => {
  const s = await getPublicPlatformSettings();
  return ((s as any)?.podcast_layout === "grid" ? "grid" : "list") as PodcastLayout;
});

export const setPodcastLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ layout: z.enum(["list", "grid"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_settings")
      .update({ podcast_layout: data.layout, updated_at: new Date().toISOString(), updated_by: context.userId }).eq("id", 1);
    await logEvent({ type: "settings_update", actor: context.userId, objectKind: "settings", objectId: "podcast_layout", result: error ? "failed" : "ok", detail: `Układ odcinków: ${data.layout}` });
    if (error) throw new Error("Nie udało się zapisać układu.");
    return { ok: true as const };
  });

type Check = { key: string; label: string; state: "ok" | "warn" | "unverified"; detail: string };

export const getSecurityStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const checks: Check[] = [];

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role");
    const n = (r: string) => (roles ?? []).filter((x) => x.role === r).length;
    checks.push({ key: "panel", label: "Kontrola dostępu do panelu", state: n("admin") > 0 ? "ok" : "warn",
      detail: `Panel otwiera się tylko kontom z rolą administratora (obecnie: ${n("admin")}). Superadministratorów: ${n("superadmin")}.` });
    checks.push({ key: "superadmin", label: "Ochrona ostatniego superadministratora", state: n("superadmin") > 1 ? "ok" : "warn",
      detail: n("superadmin") > 1 ? "Jest więcej niż jeden superadministrator." : "Jest tylko jeden superadministrator. System nie pozwoli odebrać mu roli, ale warto mieć drugie konto z tą rolą." });
    checks.push({ key: "server", label: "Weryfikacja uprawnień po stronie serwera", state: "ok",
      detail: "Każda funkcja panelu sprawdza rolę na serwerze przed wykonaniem działania, a odmowy trafiają do Dziennika zdarzeń." });

    const { data: buckets, error: bErr } = await supabaseAdmin.storage.listBuckets();
    const pub = (buckets ?? []).filter((b) => b.public).map((b) => b.name);
    checks.push(bErr ? { key: "files", label: "Dostęp do plików", state: "unverified", detail: "Nie udało się odczytać konfiguracji magazynu plików." }
      : { key: "files", label: "Dostęp do plików", state: pub.length ? "warn" : "ok",
        detail: pub.length ? `Publiczne miejsca na pliki: ${pub.join(", ")}.` : `Wszystkie miejsca na pliki (${buckets?.length ?? 0}) są prywatne. Pliki są wydawane dopiero po sprawdzeniu uprawnień.` });

    checks.push({ key: "data", label: "Ochrona danych użytkowników", state: "unverified",
      detail: "Tabele mają reguły dostępu na poziomie wierszy, ale ten ekran nie potrafi ich sprawdzić automatycznie. Weryfikuje je skan bezpieczeństwa." });
    checks.push({ key: "auth", label: "Uwierzytelnianie", state: "unverified",
      detail: "Logowanie e-mailem z potwierdzeniem adresu oraz przez Google i Apple. Ten ekran nie odczytuje konfiguracji dostawców logowania." });

    const { data: e } = await supabaseAdmin.from("email_settings").select("notification_recipient, sender_domain").eq("id", 1).maybeSingle();
    checks.push({ key: "mail", label: "Poczta systemowa", state: "warn",
      detail: `Wysyłka nieaktywna — brak podłączonego dostawcy poczty. Odbiorca powiadomień: ${e?.notification_recipient ? "ustawiony" : "nieustawiony"}; domena nadawcy: ${e?.sender_domain ? "wpisana" : "niewpisana"}.` });

    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const { data: ev } = await supabaseAdmin.from("admin_events").select("id, created_at, type, actor, object_kind, object_id, result, detail")
      .in("result", ["denied", "failed"]).gte("created_at", since).order("created_at", { ascending: false }).limit(20);
    const ids = [...new Set((ev ?? []).map((x) => x.actor).filter(Boolean))] as string[];
    const emails = new Map<string, string>();
    for (const id of ids) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      if (u?.user?.email) emails.set(id, u.user.email);
    }
    return { checks, events: (ev ?? []).map((x) => ({ ...x, actor_email: x.actor ? emails.get(x.actor) ?? null : null })) };
  });
