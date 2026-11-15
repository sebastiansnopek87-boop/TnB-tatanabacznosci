import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "npm:zod@3.25.76";

type Bucket = "library-files" | "podcast-files" | "meeting-images" | "page-images" | "media";
type Context = { supabase: any; supabaseAdmin: any; userId: string };
type Usage = { module: string; label: string; title: string; status: string; published: boolean };
type MediaObject = { bucket_id: Bucket; name: string; created_at: string; size: number; mimetype: string };

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

const BUCKETS = ["library-files", "podcast-files", "meeting-images", "page-images", "media"] as const;
const MODULE_OF: Record<Bucket, string> = {
  "library-files": "library",
  "podcast-files": "podcast",
  "meeting-images": "meetings",
  "page-images": "pages",
  media: "unknown",
};
const UPLOAD_BUCKET: Bucket = "media";
const MAX_UPLOAD = 200 * 1024 * 1024;
const ALLOWED: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "audio/mpeg": ["mp3"],
  "audio/mp4": ["m4a", "mp4"],
  "audio/x-m4a": ["m4a"],
  "audio/aac": ["aac"],
  "audio/ogg": ["ogg"],
  "audio/wav": ["wav"],
  "audio/x-wav": ["wav"],
  "audio/webm": ["webm"],
  "application/pdf": ["pdf"],
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
};
const ALLOWED_ORIGINS = new Set([
  "https://tatanabacznosci.pl",
  "https://www.tatanabacznosci.pl",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const MAX_BODY_BYTES = 64 * 1024;

const kindOf = (mime: string, name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  if (mime.startsWith("audio/") || ["mp3", "m4a", "wav", "ogg", "aac"].includes(ext)) return "audio";
  if (mime === "application/pdf" || ["pdf", "doc", "docx", "txt"].includes(ext)) return "document";
  return "other";
};

const Target = z.object({
  bucket: z.enum(BUCKETS),
  path: z.string().min(1).max(400).refine((path) => !path.includes("..")),
});
const RequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("listMedia"),
    data: z.object({
      q: z.string().max(100).default(""),
      kind: z.enum(["", "image", "audio", "document", "other"]).default(""),
      module: z.enum(["", "library", "podcast", "meetings", "pages", "unknown"]).default(""),
      sort: z.enum(["date_desc", "date_asc", "name_asc", "name_desc"]).default("date_desc"),
      page: z.number().int().min(0).max(10000).default(0),
    }),
  }),
  z.object({ action: z.literal("getMediaDetail"), data: Target }),
  z.object({
    action: z.literal("createMediaUpload"),
    data: z.object({
      name: z.string().min(1).max(200),
      type: z.string().max(100),
      size: z.number().int().positive(),
    }),
  }),
  z.object({
    action: z.literal("finalizeMediaUpload"),
    data: z.object({ path: z.string().regex(/^\d{4}\/\d{2}\/[a-z0-9-]+\.[a-z0-9]{2,5}$/) }),
  }),
  z.object({ action: z.literal("deleteMedia"), data: Target }),
]);

function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const value = JSON.parse(raw);
      if (typeof value === "string") return value;
      if (value && typeof value.default === "string") return value.default;
    } catch {
      return raw;
    }
  }
  return null;
}

function createSupabaseFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (
      (apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_")) &&
      headers.get("Authorization") === "Bearer " + apiKey
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

async function createContext(req: Request): Promise<Context> {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) throw new ApiError("Wymagane jest zalogowanie.", 401, "unauthorized");

  const url = Deno.env.get("SUPABASE_URL");
  const publishable = envKey(
    "SUPABASE_PUBLISHABLE_KEYS",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  );
  const secret = envKey(
    "SUPABASE_SECRET_KEYS",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  );
  if (!url || !publishable || !secret) {
    throw new ApiError("Usługa jest chwilowo niedostępna.", 503, "backend_not_configured");
  }

  const supabase = createClient(url, publishable, {
    global: {
      fetch: createSupabaseFetch(publishable),
      headers: { Authorization: "Bearer " + token },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  const userId = data?.user?.id;
  if (error || typeof userId !== "string" || !userId) {
    throw new ApiError("Sesja jest nieprawidłowa lub wygasła.", 401, "unauthorized");
  }

  const supabaseAdmin = createClient(url, secret, {
    global: { fetch: createSupabaseFetch(secret) },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return { supabase, supabaseAdmin, userId };
}

async function requireAdmin(ctx: Context): Promise<void> {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (!error && data === true) return;
  await logEvent(ctx, {
    type: "access_denied",
    objectKind: "media",
    result: "denied",
    detail: "Wymagana rola administratora",
  });
  throw new ApiError("Brak uprawnień administratora.", 403, "forbidden");
}

async function logEvent(
  ctx: Context,
  event: {
    type: string;
    objectKind?: string;
    objectId?: string;
    result?: "ok" | "failed" | "denied";
    detail?: string;
  },
): Promise<void> {
  try {
    const { error } = await ctx.supabaseAdmin.from("admin_events").insert({
      type: event.type,
      actor: ctx.userId,
      object_kind: event.objectKind ?? null,
      object_id: event.objectId ?? null,
      result: event.result ?? "ok",
      detail: event.detail?.slice(0, 300) ?? null,
    });
    if (error) console.error("TNB media admin audit event failed");
  } catch {
    console.error("TNB media admin audit event failed");
  }
}

// Rebuild bucket/path usage from module rows before exposing or deleting an asset.
async function buildUsage(ctx: Context): Promise<Map<string, Usage[]>> {
  const db = ctx.supabaseAdmin;
  const [li, lc, pe, me, sp, avatars] = await Promise.all([
    db.from("library_items").select("id, title, status, cover_url"),
    db.from("library_item_content").select("item_id, file_path"),
    db.from("podcast_episodes").select("id, title, status, cover_path, audio_path"),
    db.from("meetings").select("id, title, status, image_url"),
    db.from("site_pages").select("id, title, status, sections"),
    db.from("user_avatars").select("object_path"),
  ]);
  if (li.error || lc.error || pe.error || me.error || sp.error || avatars.error) {
    throw new ApiError("Nie udało się ustalić powiązań plików.", 500, "media_usage_failed");
  }

  const map = new Map<string, Usage[]>();
  const add = (key: string | null | undefined, usage: Usage) => {
    if (!key) return;
    map.set(key, [...(map.get(key) ?? []), usage]);
  };
  const items = new Map((li.data ?? []).map((row: any) => [row.id, row]));

  for (const row of li.data ?? []) {
    add(
      row.cover_url && "library-files/" + row.cover_url,
      {
        module: "library",
        label: "Okładka materiału",
        title: row.title,
        status: row.status,
        published: row.status === "published",
      },
    );
  }
  for (const content of lc.data ?? []) {
    const item = items.get(content.item_id);
    add(
      content.file_path && "library-files/" + content.file_path,
      {
        module: "library",
        label: "Plik materiału",
        title: item?.title ?? "—",
        status: item?.status ?? "",
        published: item?.status === "published",
      },
    );
  }
  for (const episode of pe.data ?? []) {
    const common = {
      module: "podcast",
      title: episode.title,
      status: episode.status,
      published: episode.status === "published",
    };
    add(episode.cover_path && "podcast-files/" + episode.cover_path, {
      ...common,
      label: "Okładka odcinka",
    });
    add(episode.audio_path && "podcast-files/" + episode.audio_path, {
      ...common,
      label: "Nagranie odcinka",
    });
  }
  for (const meeting of me.data ?? []) {
    add(
      meeting.image_url && "meeting-images/" + meeting.image_url,
      {
        module: "meetings",
        label: "Grafika spotkania",
        title: meeting.title,
        status: meeting.status,
        published: meeting.status === "published",
      },
    );
  }
  for (const page of sp.data ?? []) {
    const sections = Array.isArray(page.sections) ? page.sections as Array<{ image?: unknown }> : [];
    const names = new Set(
      sections
        .map((section) => section?.image)
        .filter((value): value is string => typeof value === "string" && !!value),
    );
    for (const name of names) {
      add("page-images/" + page.id + "/" + name, {
        module: "pages",
        label: "Zdjęcie w sekcji strony",
        title: page.title,
        status: page.status,
        published: page.status === "published",
      });
    }
  }
  for (const avatar of avatars.data ?? []) {
    add("media/" + avatar.object_path, {
      module: "account",
      label: "Avatar użytkownika",
      title: "Zdjęcie profilowe",
      status: "active",
      published: false,
    });
  }
  return map;
}

async function allObjects(ctx: Context): Promise<MediaObject[]> {
  const { data, error } = await ctx.supabaseAdmin.rpc("admin_media_objects");
  if (error) throw new ApiError("Nie udało się wczytać listy plików.", 500, "media_list_failed");
  return (data ?? []) as MediaObject[];
}

function toRow(object: MediaObject, usage: Map<string, Usage[]>) {
  const file = object.name.split("/").pop() ?? object.name;
  const key = object.bucket_id + "/" + object.name;
  return {
    bucket: object.bucket_id,
    path: object.name,
    file,
    format: (file.split(".").pop() ?? "").toUpperCase(),
    mime: object.mimetype,
    size: Number(object.size) || 0,
    created_at: object.created_at,
    kind: kindOf(object.mimetype, file),
    module: MODULE_OF[object.bucket_id] ?? "unknown",
    usages: usage.get(key) ?? [],
  };
}

type ListMediaRequest = Extract<z.infer<typeof RequestSchema>, { action: "listMedia" }>;

async function listMedia(ctx: Context, data: ListMediaRequest) {
  await requireAdmin(ctx);
  const [objects, usage] = await Promise.all([allObjects(ctx), buildUsage(ctx)]);
  const query = data.data.q.trim().toLowerCase();
  let rows = objects.map((object) => toRow(object, usage)).filter((row) =>
    (!query ||
      row.file.toLowerCase().includes(query) ||
      row.usages.some((entry) => entry.title.toLowerCase().includes(query))) &&
    (!data.data.kind || row.kind === data.data.kind) &&
    (!data.data.module || row.module === data.data.module)
  );
  const comparators = {
    date_desc: (a: typeof rows[number], b: typeof rows[number]) => b.created_at.localeCompare(a.created_at),
    date_asc: (a: typeof rows[number], b: typeof rows[number]) => a.created_at.localeCompare(b.created_at),
    name_asc: (a: typeof rows[number], b: typeof rows[number]) => a.file.localeCompare(b.file, "pl"),
    name_desc: (a: typeof rows[number], b: typeof rows[number]) => b.file.localeCompare(a.file, "pl"),
  };
  rows = rows.sort(comparators[data.data.sort]);
  const pageSize = 24;
  const start = data.data.page * pageSize;
  return { rows: rows.slice(start, start + pageSize), total: rows.length, pageSize };
}

async function getMediaDetail(ctx: Context, target: z.infer<typeof Target>) {
  await requireAdmin(ctx);
  const [objects, usage] = await Promise.all([allObjects(ctx), buildUsage(ctx)]);
  const object = objects.find(
    (item) => item.bucket_id === target.bucket && item.name === target.path,
  );
  if (!object) throw new ApiError("Plik nie istnieje.", 404, "media_not_found");

  const row = toRow(object, usage);
  let preview: string | null = null;
  if (
    row.kind === "image" ||
    row.kind === "audio" ||
    row.mime === "application/pdf" ||
    row.mime.startsWith("video/")
  ) {
    const { data, error } = await ctx.supabaseAdmin.storage
      .from(target.bucket)
      .createSignedUrl(target.path, 600);
    if (!error) preview = data?.signedUrl ?? null;
  }
  return { ...row, preview, deletable: row.usages.length === 0 };
}

async function createMediaUpload(
  ctx: Context,
  data: Extract<z.infer<typeof RequestSchema>, { action: "createMediaUpload" }>["data"],
) {
  await requireAdmin(ctx);
  const extension = (data.name.split(".").pop() ?? "").toLowerCase();
  const extensions = ALLOWED[data.type];
  if (!extensions || !extensions.includes(extension)) {
    await logEvent(ctx, {
      type: "media_rejected",
      objectKind: "media",
      result: "denied",
      detail: "Niedozwolony format: " + (data.type || "nieznany") + " (." + extension.slice(0, 8) + ")",
    });
    throw new ApiError(
      "Niedozwolony format pliku. Dozwolone: JPG, PNG, WEBP, GIF, MP3, M4A, AAC, OGG, WAV, WEBM, PDF, MP4.",
      400,
      "invalid_media_type",
    );
  }
  if (data.size > MAX_UPLOAD) {
    throw new ApiError("Plik może mieć maksymalnie 200 MB.", 400, "media_file_too_large");
  }
  const base = data.name
    .slice(0, -(extension.length + 1))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "plik";
  const now = new Date();
  const path = String(now.getUTCFullYear()) + "/" +
    String(now.getUTCMonth() + 1).padStart(2, "0") + "/" +
    base + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "." + extension;
  const { data: signed, error } = await ctx.supabaseAdmin.storage
    .from(UPLOAD_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !signed) {
    throw new ApiError("Nie udało się przygotować przesyłania.", 500, "media_upload_prepare_failed");
  }
  return { path: signed.path, token: signed.token, bucket: UPLOAD_BUCKET };
}

async function finalizeMediaUpload(ctx: Context, path: string) {
  await requireAdmin(ctx);
  const objects = await allObjects(ctx);
  const object = objects.find((item) => item.bucket_id === UPLOAD_BUCKET && item.name === path);
  if (!object) {
    throw new ApiError("Nie znaleziono przesłanego pliku.", 404, "media_upload_not_found");
  }
  const extension = path.split(".").pop() ?? "";
  const valid = (ALLOWED[object.mimetype] ?? []).includes(extension) &&
    Number(object.size) <= MAX_UPLOAD;
  if (!valid) {
    await ctx.supabaseAdmin.storage.from(UPLOAD_BUCKET).remove([path]);
    await logEvent(ctx, {
      type: "media_rejected",
      objectKind: "media",
      objectId: UPLOAD_BUCKET + "/" + path,
      result: "denied",
      detail: "Plik niezgodny z deklarowanym formatem — usunięty",
    });
    throw new ApiError("Plik został odrzucony: format niezgodny z dozwolonymi.", 400, "media_upload_rejected");
  }
  await logEvent(ctx, {
    type: "media_upload",
    objectKind: "media",
    objectId: UPLOAD_BUCKET + "/" + path,
    detail: object.mimetype + ", " + object.size + " B",
  });
  return { ok: true as const };
}

async function deleteMedia(ctx: Context, target: z.infer<typeof Target>) {
  await requireAdmin(ctx);
  const key = target.bucket + "/" + target.path;
  let usage: Map<string, Usage[]>;
  try {
    usage = await buildUsage(ctx);
  } catch {
    await logEvent(ctx, {
      type: "media_delete",
      objectKind: "media",
      objectId: key,
      result: "denied",
      detail: "Nie udało się ustalić powiązań",
    });
    throw new ApiError(
      "Nie można ustalić powiązań pliku — usunięcie zablokowane.",
      409,
      "media_usage_unavailable",
    );
  }
  const used = usage.get(key) ?? [];
  if (used.length) {
    await logEvent(ctx, {
      type: "media_delete",
      objectKind: "media",
      objectId: key,
      result: "denied",
      detail: "Plik w użyciu: " + used.map((entry) => entry.title).join(", "),
    });
    throw new ApiError(
      "Plik jest używany (" + used.map((entry) => entry.label + ": " + entry.title).join("; ") + ") — nie można go usunąć.",
      409,
      "media_in_use",
    );
  }
  const { data, error } = await ctx.supabaseAdmin.storage.from(target.bucket).remove([target.path]);
  const ok = !error && (data?.length ?? 0) > 0;
  await logEvent(ctx, {
    type: "media_delete",
    objectKind: "media",
    objectId: key,
    result: ok ? "ok" : "failed",
  });
  if (!ok) throw new ApiError("Nie udało się usunąć pliku.", 500, "media_delete_failed");
  return { ok: true as const };
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers(supabaseCorsHeaders);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  headers.delete("Access-Control-Allow-Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return Response.json(
      { error: "method_not_allowed", message: "Niedozwolona metoda." },
      { status: 405, headers },
    );
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return Response.json(
      { error: "origin_not_allowed", message: "Niedozwolone źródło żądania." },
      { status: 403, headers },
    );
  }
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    return Response.json({ error: "payload_too_large", message: "Treść żądania jest zbyt duża." }, { status: 413, headers });
  }

  let raw: unknown;
  try {
    const text = await req.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return Response.json({ error: "payload_too_large", message: "Treść żądania jest zbyt duża." }, { status: 413, headers });
    }
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid_json", message: "Nieprawidłowe dane żądania." }, { status: 400, headers });
  }

  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_error", message: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." },
      { status: 400, headers },
    );
  }

  try {
    const ctx = await createContext(req);
    let result: unknown;
    switch (parsed.data.action) {
      case "listMedia":
        result = await listMedia(ctx, parsed.data);
        break;
      case "getMediaDetail":
        result = await getMediaDetail(ctx, parsed.data.data);
        break;
      case "createMediaUpload":
        result = await createMediaUpload(ctx, parsed.data.data);
        break;
      case "finalizeMediaUpload":
        result = await finalizeMediaUpload(ctx, parsed.data.data.path);
        break;
      case "deleteMedia":
        result = await deleteMedia(ctx, parsed.data.data);
        break;
    }
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { error: error.code, message: error.message },
        { status: error.status, headers },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "validation_error", message: error.issues[0]?.message ?? "Nieprawidłowe dane." },
        { status: 400, headers },
      );
    }
    console.error("TNB media admin function failed");
    return Response.json(
      { error: "internal_error", message: "Wystąpił błąd serwera." },
      { status: 500, headers },
    );
  }
});
