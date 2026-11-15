import { createClient } from "@supabase/supabase-js";
import { corsHeaders as sdkCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "zod";

const BUCKET = "podcast-files";
const EPISODE_COLUMNS = "id, slug, title, subtitle, episode_number, summary, description, category, access, cover_path, audio_path, external_url, duration_seconds, featured, sort_order, published_at, updated_at";
const AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const CORS = new Headers({
  ...sdkCorsHeaders,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
  "X-Content-Type-Options": "nosniff",
});

function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed.default === "string") return parsed.default;
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

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Backend podcastu nie jest skonfigurowany.");
  return createClient(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type Db = ReturnType<typeof adminClient>;
type PublicEpisode = {
  id: string; slug: string; title: string; subtitle: string; episode_number: number | null;
  summary: string; category: string; access: "public" | "members" | "premium";
  has_cover: boolean; has_audio: boolean; has_external: boolean; duration_seconds: number | null;
  featured: boolean; sort_order?: number; published_at: string | null; updated_at: string;
};
type EpisodeDetail = PublicEpisode & { description: string };
type EpisodeMedia =
  | { allowed: true; src: string | null; external: string | null }
  | { allowed: false; reason: "login" | "premium" };

const EpisodeInput = z.object({
  id: z.string().uuid().nullable(),
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
  title: z.string().trim().min(3).max(200),
  subtitle: z.string().trim().max(300),
  episode_number: z.number().int().positive().max(9999).nullable(),
  summary: z.string().trim().max(600),
  description: z.string().max(20000),
  script: z.string().max(100000),
  category: z.string().regex(/^[a-z0-9_]{1,40}$/),
  access: z.enum(["public", "members", "premium"]),
  external_url: z.string().trim().max(1000).refine((value) => value === "" || /^https:\/\/\S+$/.test(value)),
  duration_seconds: z.number().int().positive().max(86400).nullable(),
  featured: z.boolean(),
  sort_order: z.number().int().min(-9999).max(9999),
  published_at: z.string().datetime({ offset: true }).nullable(),
});

const EpisodeId = z.object({ id: z.string().uuid() });
const TargetUpload = z.object({
  id: z.string().uuid(),
  kind: z.enum(["audio", "cover"]),
  type: z.string().max(100),
  size: z.number().int().positive(),
});
const AttachFile = z.object({
  id: z.string().uuid(),
  kind: z.enum(["audio", "cover"]),
  path: z.string().min(1).max(300),
  type: z.string().max(100).default(""),
});
const TargetFile = z.object({ id: z.string().uuid(), kind: z.enum(["audio", "cover"]) });

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("listEpisodes") }),
  z.object({ action: z.literal("getEpisode"), data: z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/) }) }),
  z.object({ action: z.literal("getEpisodeMedia"), data: EpisodeId }),
  z.object({ action: z.literal("adminListEpisodes") }),
  z.object({ action: z.literal("adminGetEpisode"), data: EpisodeId }),
  z.object({ action: z.literal("adminSaveEpisode"), data: EpisodeInput }),
  z.object({ action: z.literal("adminSetEpisodeStatus"), data: z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }) }),
  z.object({ action: z.literal("adminCreateUpload"), data: TargetUpload }),
  z.object({ action: z.literal("adminAttachFile"), data: AttachFile }),
  z.object({ action: z.literal("adminRemoveFile"), data: TargetFile }),
  z.object({ action: z.literal("adminPreviewAudio"), data: EpisodeId }),
]);

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

function toPublic(episode: any): EpisodeDetail {
  return {
    id: episode.id,
    slug: episode.slug,
    title: episode.title,
    subtitle: episode.subtitle ?? "",
    episode_number: episode.episode_number ?? null,
    summary: episode.summary,
    description: episode.description,
    category: episode.category,
    access: episode.access,
    has_cover: !!episode.cover_path,
    has_audio: !!episode.audio_path,
    has_external: !!episode.external_url,
    duration_seconds: episode.duration_seconds,
    featured: episode.featured,
    sort_order: episode.sort_order,
    published_at: episode.published_at,
    updated_at: episode.updated_at,
  };
}

async function authenticatedUser(db: Db, req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const { data, error } = await db.auth.getUser(match[1]);
  return error || !data.user ? null : data.user;
}

async function requireAdmin(db: Db, req: Request) {
  const user = await authenticatedUser(db, req);
  if (!user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const { data, error } = await db.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (error || !data) {
    await logEvent(db, { type: "access_denied", actor: user.id, result: "denied", objectKind: "podcast" });
    throw new HttpError(403, "Brak uprawnień administratora.");
  }
  return user;
}

async function logEvent(db: Db, event: {
  type: string; actor?: string | null; objectKind?: string | null; objectId?: string | null;
  result?: "ok" | "failed" | "denied"; detail?: string | null;
}) {
  try {
    await db.from("admin_events").insert({
      type: event.type,
      actor: event.actor ?? null,
      object_kind: event.objectKind ?? null,
      object_id: event.objectId ?? null,
      result: event.result ?? "ok",
      detail: event.detail?.slice(0, 300) ?? null,
    });
  } catch (error) {
    console.error("podcast admin event log failed", error);
  }
}

async function listEpisodes(db: Db): Promise<PublicEpisode[]> {
  const { data, error } = await db.from("podcast_episodes")
    .select(EPISODE_COLUMNS)
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false })
    .limit(300);
  if (error) throw new HttpError(500, "Nie udało się pobrać odcinków.");
  return (data ?? []).map((episode: any) => {
    const { description: _description, ...rest } = toPublic(episode);
    return rest;
  });
}

async function getEpisode(db: Db, slug: string): Promise<EpisodeDetail | null> {
  const { data, error } = await db.from("podcast_episodes")
    .select(EPISODE_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new HttpError(500, "Nie udało się pobrać odcinka.");
  return data ? toPublic(data) : null;
}

async function getEpisodeMedia(db: Db, req: Request, id: string): Promise<EpisodeMedia> {
  const { data: episode, error } = await db.from("podcast_episodes")
    .select("access, status, audio_path, external_url")
    .eq("id", id)
    .maybeSingle();
  if (error || !episode || episode.status !== "published") throw new HttpError(404, "Nie znaleziono odcinka.");

  if (episode.access !== "public") {
    const user = await authenticatedUser(db, req);
    if (!user) return { allowed: false, reason: "login" };
    if (episode.access === "premium") {
      const [{ data: isPremium, error: premiumError }, { data: isAdmin, error: adminError }] = await Promise.all([
        db.rpc("has_role", { _user_id: user.id, _role: "premium" }),
        db.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      ]);
      if ((premiumError || !isPremium) && (adminError || !isAdmin)) return { allowed: false, reason: "premium" };
    }
  }

  let src: string | null = null;
  if (episode.audio_path) {
    const { data: signed, error: signError } = await db.storage.from(BUCKET).createSignedUrl(episode.audio_path, 60 * 60 * 3);
    if (signError) throw new HttpError(500, "Nie udało się przygotować odtwarzania.");
    src = signed?.signedUrl ?? null;
  }
  return { allowed: true, src, external: episode.external_url ?? null };
}

async function adminListEpisodes(db: Db) {
  const { data, error } = await db.from("podcast_episodes")
    .select("id, slug, title, episode_number, category, access, status, featured, sort_order, published_at, audio_path, external_url, cover_path")
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) throw new HttpError(500, "Nie udało się pobrać odcinków.");
  return data ?? [];
}

async function adminGetEpisode(db: Db, id: string) {
  const { data, error } = await db.from("podcast_episodes").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new HttpError(404, "Nie znaleziono odcinka.");
  return data;
}

async function adminSaveEpisode(db: Db, userId: string, input: z.infer<typeof EpisodeInput>) {
  const { id, ...rest } = input;
  const row = { ...rest, external_url: rest.external_url || null };
  if (row.featured) {
    const { error: featuredError } = await db.from("podcast_episodes")
      .update({ featured: false })
      .eq("featured", true)
      .neq("id", id ?? "00000000-0000-0000-0000-000000000000");
    if (featuredError) throw new HttpError(500, "Nie udało się zmienić wyróżnionego odcinka.");
  }
  const query = id
    ? db.from("podcast_episodes").update(row).eq("id", id).select("id").single()
    : db.from("podcast_episodes").insert(row).select("id").single();
  const { data, error } = await query;
  await logEvent(db, {
    type: id ? "episode_edit" : "episode_create",
    actor: userId,
    objectKind: "episode",
    objectId: data?.id ?? id,
    result: error ? "failed" : "ok",
    detail: rest.title,
  });
  if (error) throw new HttpError(400, error.code === "23505" ? "Odcinek o takim adresie już istnieje." : "Nie udało się zapisać odcinka.");
  return { id: data.id as string };
}

async function adminSetEpisodeStatus(db: Db, userId: string, input: { id: string; status: "draft" | "published" | "archived" }) {
  const { data: current } = await db.from("podcast_episodes").select("published_at, audio_path, external_url").eq("id", input.id).maybeSingle();
  if (!current) throw new HttpError(404, "Nie znaleziono odcinka.");
  if (input.status === "published" && !current.audio_path && !current.external_url) {
    throw new HttpError(400, "Dodaj plik audio lub adres nagrania przed publikacją.");
  }
  const patch: { status: string; published_at?: string } = { status: input.status };
  if (input.status === "published" && !current.published_at) patch.published_at = new Date().toISOString();
  const { error } = await db.from("podcast_episodes").update(patch).eq("id", input.id);
  await logEvent(db, {
    type: `episode_${input.status}`, actor: userId, objectKind: "episode", objectId: input.id, result: error ? "failed" : "ok",
  });
  if (error) throw new HttpError(500, "Nie udało się zmienić statusu.");
  return { ok: true };
}

async function adminCreateUpload(db: Db, input: z.infer<typeof TargetUpload>) {
  if (input.kind === "audio") {
    if (!AUDIO_TYPES.includes(input.type)) throw new HttpError(400, "Plik audio musi być w formacie MP3, M4A, AAC, OGG, WAV lub WEBM.");
    if (input.size > 200 * 1024 * 1024) throw new HttpError(413, "Plik audio może mieć maksymalnie 200 MB.");
  } else {
    if (!IMAGE_TYPES.includes(input.type)) throw new HttpError(400, "Grafika musi być plikiem JPG, PNG lub WEBP.");
    if (input.size > 5 * 1024 * 1024) throw new HttpError(413, "Grafika może mieć maksymalnie 5 MB.");
  }
  const ext = (input.type.split("/")[1] ?? "bin").replace("jpeg", "jpg").replace("mpeg", "mp3").replace("x-", "");
  const path = `${input.id}/${input.kind}-${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new HttpError(500, "Nie udało się przygotować przesyłania.");
  return { path: data.path, token: data.token };
}

async function adminAttachFile(db: Db, input: z.infer<typeof AttachFile>) {
  if (!input.path.startsWith(`${input.id}/${input.kind}-`)) throw new HttpError(400, "Nieprawidłowy plik.");
  const patch = input.kind === "audio"
    ? { audio_path: input.path, audio_mime: input.type || null }
    : { cover_path: input.path };
  const { error } = await db.from("podcast_episodes").update(patch).eq("id", input.id);
  if (error) throw new HttpError(500, "Nie udało się przypisać pliku.");
  return { ok: true };
}

async function adminRemoveFile(db: Db, input: z.infer<typeof TargetFile>) {
  const patch = input.kind === "audio" ? { audio_path: null, audio_mime: null } : { cover_path: null };
  const { error } = await db.from("podcast_episodes").update(patch).eq("id", input.id);
  if (error) throw new HttpError(500, "Nie udało się usunąć pliku.");
  return { ok: true };
}

async function adminPreviewAudio(db: Db, id: string) {
  const { data: episode, error } = await db.from("podcast_episodes").select("audio_path").eq("id", id).maybeSingle();
  if (error) throw new HttpError(500, "Nie udało się pobrać odcinka.");
  if (!episode?.audio_path) return { src: null };
  const { data, error: signError } = await db.storage.from(BUCKET).createSignedUrl(episode.audio_path, 3600);
  if (signError) throw new HttpError(500, "Nie udało się przygotować podglądu audio.");
  return { src: data?.signedUrl ?? null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ message: "Niedozwolona metoda." }, 405);

  const db = adminClient();
  try {
    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return json({ message: "Nieprawidłowe żądanie." }, 400);
    const input = parsed.data;
    const protectedActions = new Set([
      "adminListEpisodes", "adminGetEpisode", "adminSaveEpisode", "adminSetEpisodeStatus",
      "adminCreateUpload", "adminAttachFile", "adminRemoveFile", "adminPreviewAudio",
    ]);
    let user: { id: string } | null = null;
    if (protectedActions.has(input.action)) user = await requireAdmin(db, req);

    switch (input.action) {
      case "listEpisodes": return json(await listEpisodes(db));
      case "getEpisode": return json(await getEpisode(db, input.data.slug));
      case "getEpisodeMedia": return json(await getEpisodeMedia(db, req, input.data.id));
      case "adminListEpisodes": return json(await adminListEpisodes(db));
      case "adminGetEpisode": return json(await adminGetEpisode(db, input.data.id));
      case "adminSaveEpisode": return json(await adminSaveEpisode(db, user!.id, input.data));
      case "adminSetEpisodeStatus": return json(await adminSetEpisodeStatus(db, user!.id, input.data));
      case "adminCreateUpload": return json(await adminCreateUpload(db, input.data));
      case "adminAttachFile": return json(await adminAttachFile(db, input.data));
      case "adminRemoveFile": return json(await adminRemoveFile(db, input.data));
      case "adminPreviewAudio": return json(await adminPreviewAudio(db, input.data.id));
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Wystąpił błąd serwera.";
    if (status >= 500) console.error("tnb-podcast error:", message);
    return json({ message }, status);
  }
  return json({ message: "Nieznana operacja." }, 400);
});
