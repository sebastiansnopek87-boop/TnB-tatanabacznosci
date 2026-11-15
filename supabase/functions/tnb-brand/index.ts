import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Context = { supabase: any; supabaseAdmin: any; userId: string };

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

const BUCKET = "media";
const BRAND_DIR = "brand";
const MAX_SIZE = 2 * 1024 * 1024;
const FILE_RE = /^brand\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|ico)$/;
const PUBLIC_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|ico)$/;
const IMAGE_KEYS = ["logo", "favicon", "og_image", "header_image"] as const;
const MIME_EXT: Record<string, string[]> = {
  "image/png": ["png", "ico"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/x-icon": ["ico"],
  "image/vnd.microsoft.icon": ["ico"],
};
const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
};

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("getBrandSettings") }),
  z.object({ action: z.literal("createBrandUpload"), name: z.string().min(1).max(200), type: z.string().max(100), size: z.number().int().positive() }),
  z.object({ action: z.literal("finalizeBrandUpload"), path: z.string().regex(FILE_RE, "Nieprawidłowa ścieżka pliku.") }),
  z.object({
    action: z.literal("saveBrandSettings"),
    settings: z.object({
      logo: z.union([z.string().regex(FILE_RE, "Nieprawidłowa referencja pliku marki."), z.literal("")]).transform((v) => v === "" ? undefined : v),
      favicon: z.union([z.string().regex(FILE_RE, "Nieprawidłowa referencja pliku marki."), z.literal("")]).transform((v) => v === "" ? undefined : v),
      og_image: z.union([z.string().regex(FILE_RE, "Nieprawidłowa referencja pliku marki."), z.literal("")]).transform((v) => v === "" ? undefined : v),
      header_image: z.union([z.string().regex(FILE_RE, "Nieprawidłowa referencja pliku marki."), z.literal("")]).transform((v) => v === "" ? undefined : v),
      header_size: z.union([z.enum(["small", "medium", "large", "very_large"]), z.literal("")]).transform((v) => v === "" ? undefined : v),
      site_name: z.union([z.string().trim().min(1, "Pole nie może być puste").max(200), z.literal("")]).transform((v) => v === "" ? undefined : v),
      slogan: z.string().trim().max(200).optional(),
      show_slogan: z.boolean().optional(),
      public_title: z.union([z.string().trim().min(1, "Pole nie może być puste").max(200), z.literal("")]).transform((v) => v === "" ? undefined : v),
      public_description: z.union([z.string().trim().min(1, "Pole nie może być puste").max(2000), z.literal("")]).transform((v) => v === "" ? undefined : v),
      site_url: z.union([
        z.string().trim().max(500).regex(/^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(\/[A-Za-z0-9._~/-]*)?$/, "Podaj poprawny publiczny adres zaczynający się od https://"),
        z.literal(""),
      ]).transform((v) => v === "" ? undefined : v),
    }).strict(),
  }),
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

function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secret = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) {
    console.error("TNB brand function runtime configuration is incomplete");
    throw new ApiError("Usługa jest chwilowo niedostępna.", 503, "backend_not_configured");
  }
  return createClient(url, secret, {
    global: { fetch: createSupabaseFetch(secret) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function createRequestContext(req: Request): Promise<Context> {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new ApiError("Wymagane jest zalogowanie.", 401, "unauthorized");
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new ApiError("Wymagane jest zalogowanie.", 401, "unauthorized");

  const url = Deno.env.get("SUPABASE_URL");
  const publishable = envKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
  if (!url || !publishable) {
    console.error("TNB brand function runtime configuration is incomplete");
    throw new ApiError("Usługa jest chwilowo niedostępna.", 503, "backend_not_configured");
  }

  const supabase = createClient(url, publishable, {
    global: { fetch: createSupabaseFetch(publishable), headers: { Authorization: "Bearer " + token } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  const userId = data?.user?.id;
  if (error || typeof userId !== "string" || !userId) {
    throw new ApiError("Sesja jest nieprawidłowa lub wygasła.", 401, "unauthorized");
  }
  return { supabase, supabaseAdmin: createAdminClient(), userId };
}

async function hasRole(ctx: Context, role: "admin" | "superadmin"): Promise<boolean> {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: role });
  return !error && !!data;
}

async function requireAdmin(ctx: Context): Promise<void> {
  if (await hasRole(ctx, "admin")) return;
  await logEvent(ctx, { type: "access_denied", objectKind: "brand", objectId: "settings", result: "denied", detail: "Wymagana rola administratora" });
  throw new ApiError("Brak uprawnień administratora.", 403, "forbidden");
}

async function requireSuperadmin(ctx: Context): Promise<void> {
  await requireAdmin(ctx);
  if (await hasRole(ctx, "superadmin")) return;
  await logEvent(ctx, { type: "access_denied", objectKind: "brand", objectId: "settings", result: "denied", detail: "Wymagana rola superadministratora" });
  throw new ApiError("Tę zmianę może wykonać tylko superadministrator.", 403, "forbidden");
}

async function logEvent(ctx: Context, event: {
  type: string; objectKind?: string; objectId?: string; result?: "ok" | "failed" | "denied"; detail?: string;
}): Promise<void> {
  try {
    const { error } = await ctx.supabaseAdmin.from("admin_events").insert({
      type: event.type, actor: ctx.userId, object_kind: event.objectKind ?? null,
      object_id: event.objectId ?? null, result: event.result ?? "ok", detail: event.detail?.slice(0, 300) ?? null,
    });
    if (error) console.error("TNB brand audit event failed");
  } catch {
    console.error("TNB brand audit event failed");
  }
}

async function getBrandSettings(ctx: Context) {
  await requireAdmin(ctx);
  const { data, error } = await ctx.supabaseAdmin.from("platform_settings").select("brand_settings").eq("id", 1).maybeSingle();
  if (error) throw new ApiError("Nie udało się pobrać ustawień marki.", 500, "brand_settings_read_failed");
  return {
    settings: (data?.brand_settings ?? {}) as Record<string, string | boolean>,
    canEdit: await hasRole(ctx, "superadmin"),
  };
}

async function createBrandUpload(ctx: Context, input: { name: string; type: string; size: number }) {
  await requireSuperadmin(ctx);
  const ext = (input.name.split(".").pop() ?? "").toLowerCase();
  const allowed = MIME_EXT[input.type];
  if (!allowed || !allowed.includes(ext)) {
    await logEvent(ctx, {
      type: "brand_upload", objectKind: "brand", result: "denied",
      detail: "Niedozwolony format: " + (input.type || "nieznany") + " (." + ext.slice(0, 8) + ")",
    });
    throw new ApiError("Niedozwolony format pliku. Dozwolone: PNG, JPG, WEBP, ICO.", 400, "invalid_file_type");
  }
  if (input.size > MAX_SIZE) throw new ApiError("Plik może mieć maksymalnie 2 MB.", 400, "file_too_large");

  const path = BRAND_DIR + "/" + crypto.randomUUID() + "." + (ext === "jpeg" ? "jpg" : ext);
  const { data, error } = await ctx.supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new ApiError("Nie udało się przygotować przesyłania.", 500, "upload_url_failed");
  return { path: data.path, token: data.token, bucket: BUCKET };
}

async function finalizeBrandUpload(ctx: Context, path: string) {
  await requireSuperadmin(ctx);
  const name = path.split("/").pop()!;
  const { data: objects, error } = await ctx.supabaseAdmin.storage.from(BUCKET).list(BRAND_DIR, { search: name });
  const object = (objects ?? []).find((entry: { name: string }) => entry.name === name);
  if (error || !object) throw new ApiError("Nie znaleziono przesłanego pliku.", 404, "upload_not_found");

  const ext = name.split(".").pop()!;
  const size = Number((object as { metadata?: { size?: number } }).metadata?.size ?? 0);
  const mime = (object as { metadata?: { mimetype?: string } }).metadata?.mimetype ?? "";
  const valid = (MIME_EXT[mime] ?? []).includes(ext) && size > 0 && size <= MAX_SIZE;

  if (!valid) {
    await ctx.supabaseAdmin.storage.from(BUCKET).remove([path]);
    await logEvent(ctx, {
      type: "brand_upload", objectKind: "brand", objectId: BUCKET + "/" + path,
      result: "denied", detail: "Plik niezgodny z deklarowanym formatem — usunięty",
    });
    throw new ApiError("Plik został odrzucony: format niezgodny z dozwolonymi.", 400, "invalid_uploaded_file");
  }

  await logEvent(ctx, { type: "brand_upload", objectKind: "brand", objectId: BUCKET + "/" + path, detail: "Przesłano plik marki" });
  return { ok: true as const };
}

async function saveBrandSettings(ctx: Context, input: Record<string, unknown>) {
  await requireSuperadmin(ctx);
  const db = ctx.supabaseAdmin;
  const { data: previousRow, error: readError } = await db.from("platform_settings").select("brand_settings").eq("id", 1).maybeSingle();
  if (readError || !previousRow) throw new ApiError("Nie udało się pobrać poprzednich ustawień marki.", 500, "brand_settings_read_failed");

  const previous = (previousRow.brand_settings ?? {}) as Record<string, string | boolean>;
  const next: Record<string, string | boolean> = { ...previous };
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) delete next[key];
    else if (typeof value === "string" || typeof value === "boolean") next[key] = value;
  }

  if (JSON.stringify(next).length > 12000) {
    throw new ApiError("Ustawienia marki są za duże — usuń niektóre wartości.", 400, "brand_settings_too_large");
  }

  const { error } = await db.from("platform_settings").update({
    brand_settings: next,
    updated_at: new Date().toISOString(),
    updated_by: ctx.userId,
  }).eq("id", 1);

  if (error) {
    await logEvent(ctx, {
      type: "settings_update", objectKind: "settings", objectId: "brand",
      result: "failed", detail: "Zapis ustawień marki odrzucony",
    });
    if (error.code === "23514") {
      throw new ApiError("Ustawienia zawierają wartości niedozwolone w publicznych ustawieniach marki.", 400, "brand_settings_constraint");
    }
    throw new ApiError("Nie udało się zapisać ustawień marki.", 500, "brand_settings_update_failed");
  }

  for (const key of IMAGE_KEYS) {
    const before = previous[key];
    if (typeof before === "string" && before && before !== next[key] && !Object.values(next).includes(before)) {
      const removed = await db.storage.from(BUCKET).remove([before]);
      await logEvent(ctx, {
        type: "brand_upload", objectKind: "brand", objectId: BUCKET + "/" + before,
        result: removed.error ? "failed" : "ok", detail: "Usunięto zastąpiony plik marki",
      });
    }
  }

  const changed = Object.keys(input).filter((key) => previous[key] !== input[key]);
  await logEvent(ctx, {
    type: "settings_update", objectKind: "settings", objectId: "brand",
    detail: changed.length ? "Zmienione pola: " + changed.join(", ") : "Bez zmian",
  });
  return { ok: true as const };
}

async function servePublicBrandImage(file: string): Promise<Response> {
  if (!PUBLIC_FILE_RE.test(file)) return new Response("Not found", { status: 404 });

  const db = createAdminClient();
  const wanted = BRAND_DIR + "/" + file;
  const { data: row, error: rowError } = await db.from("platform_settings").select("brand_settings").eq("id", 1).maybeSingle();
  if (rowError || !row) return new Response("Not found", { status: 404 });

  const settings = (row.brand_settings ?? {}) as Record<string, unknown>;
  if (!IMAGE_KEYS.some((key) => settings[key] === wanted)) return new Response("Not found", { status: 404 });

  const { data: blob, error } = await db.storage.from(BUCKET).download(wanted);
  if (error || !blob) return new Response("Not found", { status: 404 });

  const ext = file.split(".").pop() ?? "";
  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

const allowedOrigins = new Set(["https://tatanabacznosci.pl", "https://www.tatanabacznosci.pl", "http://localhost:5173"]);

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (origin && allowedOrigins.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function addHeaders(response: Response, headers: Headers): Response {
  const merged = new Headers(response.headers);
  headers.forEach((value, key) => merged.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  if (req.method === "GET") {
    const file = url.searchParams.get("file") ?? "";
    const response = await servePublicBrandImage(file);
    return addHeaders(response, headers);
  }

  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed", message: "Niedozwolona metoda żądania." }, { status: 405, headers });
  }

  if (origin && !allowedOrigins.has(origin)) {
    return Response.json({ error: "origin_not_allowed", message: "Niedozwolone źródło żądania." }, { status: 403, headers });
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
      case "getBrandSettings":
        result = await getBrandSettings(ctx);
        break;
      case "createBrandUpload":
        result = await createBrandUpload(ctx, parsed.data);
        break;
      case "finalizeBrandUpload":
        result = await finalizeBrandUpload(ctx, parsed.data.path);
        break;
      case "saveBrandSettings":
        result = await saveBrandSettings(ctx, parsed.data.settings);
        break;
    }

    return addHeaders(Response.json(result), headers);
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status, headers });
    }
    console.error("TNB brand function failed");
    return Response.json({ error: "internal_error", message: "Wystąpił błąd serwera." }, { status: 500, headers });
  }
});
