import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";

type Context = { supabase: any; supabaseAdmin: any; userId: string };

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

const MODULE_IDS = ["about", "history", "articles", "library", "voice", "community", "consult", "meetings", "contact", "newsletter"] as const;
const PUBLIC_COLS = "id, platform_name, contact_email, support_email, notice_enabled, maintenance_enabled, maintenance_message, social_youtube, social_spotify, social_tiktok, social_instagram, podcast_layout, module_visibility, brand_settings, visual_effects, company_legal_name, company_legal_form, company_nip, company_regon, company_krs, company_address_street, company_address_postal, company_address_city, company_address_country, contact_phone, contact_hours, footer_description, footer_copyright, footer_show_contact";
const BILLING_COLS = "billing_same_as_company, billing_name, billing_nip, billing_address";
const ALL_SETTINGS_COLS = PUBLIC_COLS + ", " + BILLING_COLS + ", updated_at";

const VisualEffectsSchema = z.object({
  enabled: z.boolean(),
  intensity: z.enum(["subtle", "standard", "off"]),
  speed: z.enum(["fast", "standard", "calm"]),
  reveal: z.boolean(),
  interactive: z.boolean(),
  panels: z.boolean(),
}).strict();

const optEmail = z.union([z.string().trim().email("Podaj poprawny adres e-mail").max(255), z.literal("")]).transform((v) => v === "" ? null : v);
const optUrl = z.union([z.string().trim().url("Podaj pełny adres zaczynający się od https://").max(500).refine((v) => v.startsWith("https://"), "Adres musi zaczynać się od https://"), z.literal("")]).transform((v) => v === "" ? null : v);
const optText = (max: number) => z.union([z.string().trim().max(max), z.literal("")]).transform((v) => v === "" ? null : v);
const optNip = z.union([z.string().trim().regex(/^\d{10}$/, "NIP musi mieć dokładnie 10 cyfr (bez myślników)"), z.literal("")]).transform((v) => v === "" ? null : v);
const optRegon = z.union([z.string().trim().regex(/^\d{9}(\d{5})?$/, "REGON musi mieć 9 lub 14 cyfr"), z.literal("")]).transform((v) => v === "" ? null : v);
const optKrs = z.union([z.string().trim().regex(/^\d{10}$/, "KRS musi mieć dokładnie 10 cyfr"), z.literal("")]).transform((v) => v === "" ? null : v);
const optPostal = z.union([z.string().trim().regex(/^\d{2}-\d{3}$/, "Kod pocztowy w formacie 00-000"), z.literal("")]).transform((v) => v === "" ? null : v);
const optPhone = z.union([z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/, "Podaj poprawny numer telefonu"), z.literal("")]).transform((v) => v === "" ? null : v);

const platformSchema = z.object({
  social_youtube: optUrl,
  social_spotify: optUrl,
  social_tiktok: optUrl,
  social_instagram: optUrl,
  platform_name: z.string().trim().min(1, "Podaj nazwę platformy").max(100),
  contact_email: optEmail,
  support_email: optEmail,
  notice_enabled: z.boolean(),
  maintenance_enabled: z.boolean(),
  maintenance_message: z.string().trim().max(500, "Komunikat może mieć najwyżej 500 znaków"),
  company_legal_name: optText(200),
  company_legal_form: optText(100),
  company_nip: optNip,
  company_regon: optRegon,
  company_krs: optKrs,
  company_address_street: optText(200),
  company_address_postal: optPostal,
  company_address_city: optText(100),
  company_address_country: optText(100),
  contact_phone: optPhone,
  contact_hours: optText(200),
  billing_same_as_company: z.boolean(),
  billing_name: optText(200),
  billing_nip: optNip,
  billing_address: optText(300),
  footer_description: optText(500),
  footer_copyright: optText(200),
  footer_show_contact: z.boolean(),
}).refine((d) => !(d.notice_enabled || d.maintenance_enabled) || d.maintenance_message.length > 0, {
  message: "Wpisz treść komunikatu, zanim go włączysz.",
  path: ["maintenance_message"],
}).refine((d) => d.billing_same_as_company || !!d.billing_name, {
  message: "Podaj nazwę nabywcy na fakturze albo włącz kopiowanie danych podmiotu.",
  path: ["billing_name"],
});

const moduleVisibilitySchema = z.record(
  z.enum(MODULE_IDS),
  z.object({ menu: z.boolean(), page: z.boolean() }).strict(),
);

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("getPlatformSettings") }),
  z.object({ action: z.literal("updatePlatformSettings"), settings: platformSchema }),
  z.object({ action: z.literal("setPrelaunchSettings"), enabled: z.boolean(), message: z.string().trim().min(1, "Wpisz tekst zapowiedzi.").max(500, "Tekst może mieć najwyżej 500 znaków") }),
  z.object({ action: z.literal("setVisualEffects"), effects: VisualEffectsSchema }),
  z.object({ action: z.literal("setModuleVisibility"), visibility: moduleVisibilitySchema }),
  z.object({ action: z.literal("setPodcastLayout"), layout: z.enum(["list", "grid"]) }),
  z.object({ action: z.literal("getSecurityStatus") }),
]);

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

async function createRequestContext(req: Request): Promise<Context> {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new ApiError("Wymagane jest zalogowanie.", 401, "unauthorized");
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new ApiError("Wymagane jest zalogowanie.", 401, "unauthorized");

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = envKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
  const secretKey = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publishableKey || !secretKey) {
    console.error("TNB platform function runtime configuration is incomplete");
    throw new ApiError("Usługa jest chwilowo niedostępna.", 503, "backend_not_configured");
  }

  const supabase = createClient(url, publishableKey, {
    global: { fetch: createSupabaseFetch(publishableKey), headers: { Authorization: "Bearer " + token } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  const userId = data?.user?.id;
  if (error || typeof userId !== "string" || !userId) {
    throw new ApiError("Sesja jest nieprawidłowa lub wygasła.", 401, "unauthorized");
  }

  const supabaseAdmin = createClient(url, secretKey, {
    global: { fetch: createSupabaseFetch(secretKey) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { supabase, supabaseAdmin, userId };
}

async function hasRole(ctx: Context, role: "admin" | "superadmin"): Promise<boolean> {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: role });
  return !error && !!data;
}

async function logEvent(ctx: Context, event: {
  type: string; objectKind?: string; objectId?: string; result?: "ok" | "failed" | "denied"; detail?: string;
}): Promise<void> {
  try {
    const { error } = await ctx.supabaseAdmin.from("admin_events").insert({
      type: event.type, actor: ctx.userId, object_kind: event.objectKind ?? null,
      object_id: event.objectId ?? null, result: event.result ?? "ok", detail: event.detail?.slice(0, 300) ?? null,
    });
    if (error) console.error("TNB platform audit event failed");
  } catch {
    console.error("TNB platform audit event failed");
  }
}

async function requireAdmin(ctx: Context): Promise<void> {
  if (await hasRole(ctx, "admin")) return;
  await logEvent(ctx, { type: "access_denied", objectKind: "settings", objectId: "platform", result: "denied", detail: "Wymagana rola administratora" });
  throw new ApiError("Brak uprawnień administratora.", 403, "forbidden");
}

async function requireSuperadmin(ctx: Context, operation: string): Promise<void> {
  await requireAdmin(ctx);
  if (await hasRole(ctx, "superadmin")) return;
  await logEvent(ctx, { type: "access_denied", objectKind: "settings", objectId: operation, result: "denied", detail: "Wymagana rola superadministratora" });
  throw new ApiError("Tę zmianę może wykonać tylko superadministrator.", 403, "forbidden");
}

async function getPlatformSettings(ctx: Context) {
  await requireAdmin(ctx);
  const { data: settings, error } = await ctx.supabaseAdmin.from("platform_settings")
    .select(ALL_SETTINGS_COLS).eq("id", 1).maybeSingle();
  if (error || !settings) throw new ApiError("Nie udało się pobrać ustawień platformy.", 500, "settings_read_failed");

  const { data: email, error: emailError } = await ctx.supabaseAdmin.from("email_settings")
    .select("notification_recipient, sender_name, sender_local_part, sender_domain, contact_notifications_enabled, newsletter_notifications_enabled, newsletter_double_opt_in")
    .eq("id", 1).maybeSingle();
  if (emailError) throw new ApiError("Nie udało się pobrać ustawień poczty.", 500, "email_settings_read_failed");
  return { settings, email: email ?? null, canEdit: await hasRole(ctx, "superadmin") };
}

async function updatePlatformSettings(ctx: Context, settings: z.infer<typeof platformSchema>) {
  await requireSuperadmin(ctx, "platform_settings");
  const { data: previous, error: previousError } = await ctx.supabaseAdmin.from("platform_settings")
    .select(PUBLIC_COLS + ", " + BILLING_COLS).eq("id", 1).maybeSingle();
  if (previousError || !previous) throw new ApiError("Nie udało się pobrać poprzednich ustawień.", 500, "settings_read_failed");

  const { error } = await ctx.supabaseAdmin.from("platform_settings")
    .update({ ...settings, updated_at: new Date().toISOString(), updated_by: ctx.userId }).eq("id", 1);
  if (error) {
    await logEvent(ctx, { type: "settings_update", objectKind: "settings", objectId: "platform", result: "failed" });
    throw new ApiError("Nie udało się zapisać ustawień.", 500, "settings_update_failed");
  }

  const changed = Object.keys(settings).filter((key) => previous[key] !== settings[key]);
  await logEvent(ctx, { type: "settings_update", objectKind: "settings", objectId: "platform", detail: changed.length ? "Zmienione pola: " + changed.join(", ") : "Bez zmian" });
  if (previous.maintenance_enabled !== settings.maintenance_enabled) {
    await logEvent(ctx, { type: settings.maintenance_enabled ? "maintenance_on" : "maintenance_off", objectKind: "settings", objectId: "maintenance" });
  }
  return { ok: true as const };
}

async function setPrelaunchSettings(ctx: Context, enabled: boolean, message: string) {
  await requireAdmin(ctx);
  const { error } = await ctx.supabaseAdmin.from("platform_settings")
    .update({
      maintenance_enabled: enabled,
      maintenance_message: message.trim(),
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    }).eq("id", 1);
  await logEvent(ctx, {
    type: enabled ? "prelaunch_on" : "prelaunch_off",
    objectKind: "settings",
    objectId: "prelaunch",
    result: error ? "failed" : "ok",
    detail: enabled ? "Włączono stronę przedpremierową." : "Wyłączono stronę przedpremierową.",
  });
  if (error) throw new ApiError("Nie udało się zapisać ustawień strony przedpremierowej.", 500, "prelaunch_update_failed");
  return { ok: true as const };
}

async function setVisualEffects(ctx: Context, effects: z.infer<typeof VisualEffectsSchema>) {
  await requireSuperadmin(ctx, "visual_effects");
  const { error } = await ctx.supabaseAdmin.from("platform_settings")
    .update({ visual_effects: effects, updated_at: new Date().toISOString(), updated_by: ctx.userId }).eq("id", 1);
  await logEvent(ctx, {
    type: "settings_update", objectKind: "settings", objectId: "visual_effects",
    result: error ? "failed" : "ok",
    detail: "Efekty: " + (effects.enabled ? "włączone" : "wyłączone") + ", " + effects.intensity + ", " + effects.speed +
      ", sekcje=" + effects.reveal + ", przyciski=" + effects.interactive + ", menu=" + effects.panels,
  });
  if (error) throw new ApiError("Nie udało się zapisać ustawień efektów.", 500, "visual_effects_update_failed");
  return { ok: true as const };
}

async function setModuleVisibility(ctx: Context, visibility: z.infer<typeof moduleVisibilitySchema>) {
  await requireSuperadmin(ctx, "module_visibility");
  const { error } = await ctx.supabaseAdmin.from("platform_settings")
    .update({ module_visibility: visibility, updated_at: new Date().toISOString(), updated_by: ctx.userId }).eq("id", 1);
  await logEvent(ctx, {
    type: "settings_update", objectKind: "settings", objectId: "module_visibility",
    result: error ? "failed" : "ok",
    detail: "Widoczność modułów: " + Object.keys(visibility).join(", "),
  });
  if (error) throw new ApiError("Nie udało się zapisać widoczności modułów.", 500, "module_visibility_update_failed");
  return { ok: true as const };
}

async function setPodcastLayout(ctx: Context, layout: "list" | "grid") {
  await requireAdmin(ctx);
  const { error } = await ctx.supabaseAdmin.from("platform_settings")
    .update({ podcast_layout: layout, updated_at: new Date().toISOString(), updated_by: ctx.userId }).eq("id", 1);
  await logEvent(ctx, { type: "settings_update", objectKind: "settings", objectId: "podcast_layout", result: error ? "failed" : "ok", detail: "Układ odcinków: " + layout });
  if (error) throw new ApiError("Nie udało się zapisać układu.", 500, "podcast_layout_update_failed");
  return { ok: true as const };
}

type SecurityCheck = { key: string; label: string; state: "ok" | "warn" | "unverified"; detail: string };

async function getSecurityStatus(ctx: Context) {
  await requireAdmin(ctx);
  const checks: SecurityCheck[] = [];
  const { data: roles, error: roleError } = await ctx.supabaseAdmin.from("user_roles").select("role");
  if (roleError) throw new ApiError("Nie udało się pobrać ról użytkowników.", 500, "security_status_failed");

  const countRole = (role: string) => (roles ?? []).filter((row: { role: string }) => row.role === role).length;
  const adminCount = countRole("admin");
  const superadminCount = countRole("superadmin");
  checks.push({
    key: "panel", label: "Kontrola dostępu do panelu", state: adminCount > 0 ? "ok" : "warn",
    detail: "Panel otwiera się tylko kontom z rolą administratora (obecnie: " + adminCount + "). Superadministratorów: " + superadminCount + ".",
  });
  checks.push({
    key: "superadmin", label: "Ochrona ostatniego superadministratora", state: superadminCount > 1 ? "ok" : "warn",
    detail: superadminCount > 1 ? "Jest więcej niż jeden superadministrator." : "Jest tylko jeden superadministrator. System nie pozwoli odebrać mu roli, ale warto mieć drugie konto z tą rolą.",
  });
  checks.push({
    key: "server", label: "Weryfikacja uprawnień po stronie serwera", state: "ok",
    detail: "Operacje administracyjne sprawdzają rolę po stronie backendu przed wykonaniem działania.",
  });

  const { data: buckets, error: bucketError } = await ctx.supabaseAdmin.storage.listBuckets();
  const publicBuckets = (buckets ?? []).filter((bucket: { public: boolean; name: string }) => bucket.public).map((bucket: { name: string }) => bucket.name);
  checks.push(bucketError
    ? { key: "files", label: "Dostęp do plików", state: "unverified", detail: "Nie udało się odczytać konfiguracji magazynu plików." }
    : {
      key: "files", label: "Dostęp do plików", state: publicBuckets.length ? "warn" : "ok",
      detail: publicBuckets.length
        ? "Publiczne miejsca na pliki: " + publicBuckets.join(", ") + "."
        : "Wszystkie miejsca na pliki (" + (buckets?.length ?? 0) + ") są prywatne. Pliki są wydawane dopiero po sprawdzeniu uprawnień.",
    });

  checks.push({ key: "data", label: "Ochrona danych użytkowników", state: "unverified", detail: "Tabele mają reguły dostępu na poziomie wierszy, ale ten ekran nie potrafi ich sprawdzić automatycznie. Weryfikuje je skan bezpieczeństwa." });
  checks.push({ key: "auth", label: "Uwierzytelnianie", state: "unverified", detail: "Logowanie e-mailem z potwierdzeniem adresu oraz przez Google i Apple. Ten ekran nie odczytuje konfiguracji dostawców logowania." });

  const { data: emailSettings, error: emailError } = await ctx.supabaseAdmin.from("email_settings")
    .select("notification_recipient, sender_domain").eq("id", 1).maybeSingle();
  if (emailError) throw new ApiError("Nie udało się pobrać konfiguracji poczty.", 500, "security_status_failed");
  checks.push({
    key: "mail", label: "Poczta systemowa", state: "warn",
    detail: "Wysyłka nieaktywna — brak podłączonego dostawcy poczty. Odbiorca powiadomień: " +
      (emailSettings?.notification_recipient ? "ustawiony" : "nieustawiony") + "; domena nadawcy: " +
      (emailSettings?.sender_domain ? "wpisana" : "niewpisana") + ".",
  });

  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: events, error: eventsError } = await ctx.supabaseAdmin.from("admin_events")
    .select("id, created_at, type, actor, object_kind, object_id, result, detail")
    .in("result", ["denied", "failed"]).gte("created_at", since)
    .order("created_at", { ascending: false }).limit(20);
  if (eventsError) throw new ApiError("Nie udało się pobrać dziennika zdarzeń.", 500, "security_status_failed");

  const actorIds = [...new Set((events ?? []).map((event: { actor: string | null }) => event.actor).filter(Boolean))] as string[];
  const emails = new Map<string, string>();
  for (const id of actorIds) {
    const { data: user } = await ctx.supabaseAdmin.auth.admin.getUserById(id);
    if (user?.user?.email) emails.set(id, user.user.email);
  }
  return {
    checks,
    events: (events ?? []).map((event: any) => ({ ...event, actor_email: event.actor ? emails.get(event.actor) ?? null : null })),
  };
}

const allowedOrigins = new Set(["https://tatanabacznosci.pl", "https://www.tatanabacznosci.pl", "http://localhost:5173"]);

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers(supabaseCorsHeaders);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  headers.delete("Access-Control-Allow-Origin");
  if (origin && allowedOrigins.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function addHeaders(response: Response, headers: Headers): Response {
  const merged = new Headers(response.headers);
  headers.forEach((value, key) => merged.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (origin && !allowedOrigins.has(origin)) {
    return Response.json({ error: "origin_not_allowed", message: "Niedozwolone źródło żądania." }, { status: 403, headers });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed", message: "Dozwolona jest metoda POST." }, { status: 405, headers });
  }

  try {
    const ctx = await createRequestContext(req);
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return Response.json({ error: "invalid_json", message: "Nieprawidłowe dane żądania." }, { status: 400, headers });
    }

    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: "validation_error", message: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane żądania." }, { status: 400, headers });
    }

    let result: unknown;
    switch (parsed.data.action) {
      case "getPlatformSettings": result = await getPlatformSettings(ctx); break;
      case "updatePlatformSettings": result = await updatePlatformSettings(ctx, parsed.data.settings); break;
      case "setPrelaunchSettings": result = await setPrelaunchSettings(ctx, parsed.data.enabled, parsed.data.message); break;
      case "setVisualEffects": result = await setVisualEffects(ctx, parsed.data.effects); break;
      case "setModuleVisibility": result = await setModuleVisibility(ctx, parsed.data.visibility); break;
      case "setPodcastLayout": result = await setPodcastLayout(ctx, parsed.data.layout); break;
      case "getSecurityStatus": result = await getSecurityStatus(ctx); break;
    }
    return addHeaders(Response.json(result), headers);
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status, headers });
    }
    console.error("TNB platform function failed");
    return Response.json({ error: "internal_error", message: "Wystąpił błąd serwera." }, { status: 500, headers });
  }
});
