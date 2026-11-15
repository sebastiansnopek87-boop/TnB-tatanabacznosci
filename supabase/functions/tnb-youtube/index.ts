import { createClient } from "@supabase/supabase-js";
import { corsHeaders as sdkCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "zod";

const API = "https://www.googleapis.com/youtube/v3";
const MAX_PAGES = 4;
const STALE_MS = 30 * 60 * 1000;
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
  if (!url || !key) throw new Error("Backend YouTube nie jest skonfigurowany.");
  return createClient(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type Db = ReturnType<typeof adminClient>;
type VideoSource = "manual" | "youtube";
type PublicVideo = {
  id: string;
  youtube_id: string | null;
  external_url: string | null;
  title: string;
  description: string;
  published_on: string | null;
  published_at: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  source: VideoSource;
  category: string | null;
  featured: boolean;
};
type AdminVideo = PublicVideo & {
  status: "draft" | "published" | "hidden";
  synced_at: string | null;
  sort_order: number;
  is_custom_title: boolean;
  is_custom_description: boolean;
  custom_thumbnail_url: string | null;
  archived_at: string | null;
  yt_thumbnail_url: string | null;
};
type YoutubeVideo = {
  youtube_id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  published_at: string;
  duration_seconds: number | null;
};

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
class YtError extends Error {}

const ApiKeyInput = z.object({
  key: z.string().trim().min(20, "Klucz jest za krótki").max(100)
    .regex(/^[A-Za-z0-9_-]+$/, "Klucz zawiera niedozwolone znaki."),
});
const ChannelInput = z.object({ input: z.string().trim().min(2, "Podaj kanał").max(300) });
const VideoStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "published", "hidden", "archived"]),
});
const VideoUpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Podaj tytuł").max(200),
  description: z.string().trim().max(1000, "Maksymalnie 1000 znaków"),
  custom_thumbnail_url: z.string().trim().max(500).refine((value) => !value || /^https:\/\//.test(value), "Adres miniatury musi zaczynać się od https://"),
  category: z.string().trim().max(60),
  featured: z.boolean(),
  sort_order: z.number().int().min(-9999).max(9999),
  published_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  reset_title: z.boolean().default(false),
  reset_description: z.boolean().default(false),
});
const ManualVideoInput = z.object({
  url: z.string().trim().min(5).max(300),
  title: z.string().trim().min(1, "Podaj tytuł").max(200),
  description: z.string().trim().max(1000),
  custom_thumbnail_url: z.string().trim().max(500).refine((value) => !value || /^https:\/\//.test(value)),
  category: z.string().trim().max(60),
  published_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["draft", "published"]),
});

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("listVideos") }),
  z.object({ action: z.literal("getPublicChannel") }),
  z.object({ action: z.literal("adminGetYoutubeSource") }),
  z.object({ action: z.literal("adminSaveYoutubeKey"), data: ApiKeyInput }),
  z.object({ action: z.literal("adminTestYoutubeKey") }),
  z.object({ action: z.literal("adminSaveYoutubeSource"), data: ChannelInput }),
  z.object({ action: z.literal("adminSyncYoutube") }),
  z.object({ action: z.literal("adminSyncIfStale") }),
  z.object({ action: z.literal("adminListVideos") }),
  z.object({ action: z.literal("adminSetVideoStatus"), data: VideoStatusInput }),
  z.object({ action: z.literal("adminUpdateVideo"), data: VideoUpdateInput }),
  z.object({ action: z.literal("adminAddManualVideo"), data: ManualVideoInput }),
]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
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
    console.error("YouTube event log failed", error);
  }
}

async function requireAdmin(db: Db, req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const { data, error } = await db.auth.getUser(match[1]);
  if (error || !data.user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const { data: isAdmin, error: roleError } = await db.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  if (roleError || !isAdmin) {
    await logEvent(db, { type: "access_denied", actor: data.user.id, objectKind: "youtube", result: "denied" });
    throw new HttpError(403, "Brak uprawnień administratora.");
  }
  return data.user;
}

function maskKey(key: string) {
  const value = key.trim();
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return value.slice(0, 4) + "•".repeat(Math.max(4, value.length - 8)) + value.slice(-4);
}

async function currentKey(db: Db): Promise<{ key: string; source: "panel" | "env" | null }> {
  const { data, error } = await db.from("youtube_secret").select("api_key").eq("id", 1).maybeSingle();
  if (error) throw new HttpError(500, "Nie udało się odczytać konfiguracji klucza YouTube.");
  if (data?.api_key) return { key: data.api_key, source: "panel" };
  const fallback = Deno.env.get("YOUTUBE_API_KEY") ?? "";
  return { key: fallback, source: fallback ? "env" : null };
}

async function youtubeCall(db: Db, path: string, params: Record<string, string>, override?: string) {
  const key = override ?? (await currentKey(db)).key;
  if (!key) throw new YtError("Brak klucza YouTube API — synchronizacja z YouTube nie jest skonfigurowana.");
  const url = new URL(API + "/" + path);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("key", key);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({})) as {
    error?: { message?: string; errors?: Array<{ reason?: string }>; details?: Array<{ reason?: string }> };
    items?: unknown[];
    nextPageToken?: string;
  };
  if (!response.ok) {
    const reason = payload.error?.details?.find((entry) => entry.reason)?.reason
      ?? payload.error?.errors?.find((entry) => entry.reason)?.reason;
    throw new YtError("YouTube API (" + response.status + (reason ? ", " + reason : "") + "): " + (payload.error?.message ?? "błąd"));
  }
  return payload;
}

async function testKey(db: Db, key: string) {
  await youtubeCall(db, "i18nRegions", { part: "snippet", hl: "pl" }, key);
}

function parseChannelInput(input: string): { id?: string; handle?: string } | null {
  const value = input.trim();
  if (/^UC[A-Za-z0-9_-]{22}$/.test(value)) return { id: value };
  if (/^@[A-Za-z0-9._-]{3,100}$/.test(value)) return { handle: value };
  try {
    const url = new URL(value.startsWith("http") ? value : "https://" + value);
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "channel" && parts[1] && /^UC[A-Za-z0-9_-]{22}$/.test(parts[1])) return { id: parts[1] };
    if (parts[0]?.startsWith("@")) return { handle: decodeURIComponent(parts[0]) };
  } catch {
    return null;
  }
  return null;
}

function bestThumb(thumbs?: Record<string, { url: string }>) {
  return thumbs?.maxres?.url ?? thumbs?.standard?.url ?? thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url ?? null;
}

async function resolveChannel(db: Db, input: string) {
  const parsed = parseChannelInput(input);
  if (!parsed) throw new YtError("Nie rozpoznano kanału. Podaj adres kanału, handle (@nazwa) albo Channel ID (UC…).");
  const payload = await youtubeCall(db, "channels", {
    part: "snippet,contentDetails",
    ...(parsed.id ? { id: parsed.id } : { forHandle: parsed.handle! }),
  });
  const channel = (payload.items?.[0] ?? null) as null | {
    id: string;
    snippet: { title: string; customUrl?: string; thumbnails?: Record<string, { url: string }> };
    contentDetails: { relatedPlaylists: { uploads: string } };
  };
  if (!channel) throw new YtError("Nie znaleziono takiego kanału YouTube.");
  return {
    channel_id: channel.id,
    channel_title: channel.snippet.title,
    channel_thumb: bestThumb(channel.snippet.thumbnails),
    channel_url: channel.snippet.customUrl
      ? "https://www.youtube.com/" + channel.snippet.customUrl
      : "https://www.youtube.com/channel/" + channel.id,
    uploads_playlist: channel.contentDetails.relatedPlaylists.uploads,
  };
}

function isoDuration(value?: string) {
  const match = value && /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return null;
  return Number(match[1] ?? 0) * 86400 + Number(match[2] ?? 0) * 3600
    + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
}

async function fetchUploads(db: Db, playlist: string): Promise<YoutubeVideo[]> {
  const ids: string[] = [];
  let page: string | undefined;
  for (let index = 0; index < MAX_PAGES; index++) {
    const payload = await youtubeCall(db, "playlistItems", {
      part: "contentDetails", playlistId: playlist, maxResults: "50",
      ...(page ? { pageToken: page } : {}),
    });
    for (const item of (payload.items ?? []) as Array<{ contentDetails?: { videoId?: string } }>) {
      if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
    }
    page = payload.nextPageToken;
    if (!page) break;
  }
  const output: YoutubeVideo[] = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const payload = await youtubeCall(db, "videos", {
      part: "snippet,contentDetails,status",
      id: ids.slice(offset, offset + 50).join(","),
    });
    const videos = (payload.items ?? []) as Array<{
      id: string;
      snippet: { title: string; description: string; publishedAt: string; thumbnails?: Record<string, { url: string }>; liveBroadcastContent?: string };
      contentDetails: { duration?: string };
      status: { privacyStatus: string };
    }>;
    for (const video of videos) {
      if (video.status.privacyStatus !== "public" || video.snippet.liveBroadcastContent === "upcoming") continue;
      output.push({
        youtube_id: video.id,
        title: video.snippet.title.slice(0, 200),
        description: video.snippet.description.slice(0, 5000),
        thumbnail_url: bestThumb(video.snippet.thumbnails),
        published_at: video.snippet.publishedAt,
        duration_seconds: isoDuration(video.contentDetails.duration),
      });
    }
  }
  return output;
}

async function runSync(db: Db, actor: string | null) {
  const now = new Date().toISOString();
  const { data: source, error: sourceError } = await db.from("youtube_source").select("*").eq("id", 1).single();
  if (sourceError || !source?.uploads_playlist) throw new YtError("Najpierw zapisz i sprawdź kanał YouTube.");
  await db.from("youtube_source").update({ last_attempt_at: now }).eq("id", 1);
  try {
    const videos = await fetchUploads(db, source.uploads_playlist);
    const { data: existing, error: existingError } = await db.from("podcast_videos")
      .select("id, youtube_id, title, description, thumbnail_url, published_at, duration_seconds, is_custom_title, is_custom_description");
    if (existingError) throw new HttpError(500, "Nie udało się odczytać obecnych materiałów.");
    const byYoutubeId = new Map((existing ?? []).map((row: any) => [row.youtube_id, row]));
    let added = 0, updated = 0, skipped = 0, keptCustom = 0;
    const errors: string[] = [];
    for (const video of videos) {
      const description = video.description.slice(0, 1000);
      const existingVideo = byYoutubeId.get(video.youtube_id) as any;
      if (!existingVideo) {
        const { error } = await db.from("podcast_videos").insert({
          youtube_id: video.youtube_id, title: video.title, description, thumbnail_url: video.thumbnail_url,
          published_at: video.published_at, published_on: video.published_at.slice(0, 10),
          duration_seconds: video.duration_seconds, source: "youtube", synced_at: now, updated_at: now, status: "published",
        });
        if (error) errors.push(video.youtube_id + ": " + error.message);
        else added++;
        continue;
      }
      const patch: Record<string, unknown> = {};
      if (!existingVideo.is_custom_title && existingVideo.title !== video.title) patch.title = video.title;
      if (!existingVideo.is_custom_description && existingVideo.description !== description) patch.description = description;
      if ((existingVideo.is_custom_title && existingVideo.title !== video.title)
        || (existingVideo.is_custom_description && existingVideo.description !== description)) keptCustom++;
      if (existingVideo.thumbnail_url !== video.thumbnail_url) patch.thumbnail_url = video.thumbnail_url;
      if (existingVideo.duration_seconds !== video.duration_seconds) patch.duration_seconds = video.duration_seconds;
      if (!existingVideo.published_at || new Date(existingVideo.published_at).toISOString() !== new Date(video.published_at).toISOString()) {
        patch.published_at = video.published_at;
        patch.published_on = video.published_at.slice(0, 10);
      }
      if (!Object.keys(patch).length) { skipped++; continue; }
      const { error } = await db.from("podcast_videos").update({ ...patch, synced_at: now, updated_at: now }).eq("id", existingVideo.id);
      if (error) errors.push(video.youtube_id + ": " + error.message);
      else updated++;
    }
    const { count, error: countError } = await db.from("podcast_videos").select("id", { count: "exact", head: true }).eq("source", "youtube");
    const report = { at: now, fetched: videos.length, added, updated, skipped, kept_custom: keptCustom, errors: errors.slice(0, 20) };
    await db.from("youtube_source").update({
      status: errors.length || countError ? "error" : "ok",
      last_error: errors.length ? "Błędy zapisu: " + errors.length + " (szczegóły w raporcie)" : countError ? "Nie udało się policzyć materiałów." : null,
      last_sync_at: now, last_sync_added: added, last_sync_updated: updated, last_sync_skipped: skipped,
      last_sync_report: report, video_count: count ?? 0,
    }).eq("id", 1);
    await logEvent(db, {
      type: "youtube_sync", actor, objectKind: "youtube_source", objectId: source.channel_id ?? "1",
      result: errors.length || countError ? "failed" : "ok",
      detail: "+" + added + " / ~" + updated + " / =" + skipped + " / błędy " + errors.length,
    });
    return { added, updated, skipped, keptCustom, errors: errors.length, total: count ?? 0, fetched: videos.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd";
    await db.from("youtube_source").update({
      status: "error",
      last_error: message.slice(0, 500),
      last_sync_report: { at: now, fatal: message.slice(0, 500) },
    }).eq("id", 1);
    throw error instanceof YtError ? error : new YtError(message);
  }
}

async function syncIfStale(db: Db) {
  try {
    if (!(await currentKey(db)).key) return;
    const cutoff = new Date(Date.now() - STALE_MS).toISOString();
    const { data, error } = await db.from("youtube_source")
      .update({ last_attempt_at: new Date().toISOString() })
      .eq("id", 1).not("uploads_playlist", "is", null)
      .or("last_attempt_at.is.null,last_attempt_at.lt." + cutoff).select("id");
    if (error || !data?.length) return;
    await runSync(db, null);
  } catch (error) {
    console.error("YouTube syncIfStale failed", error instanceof Error ? error.message : error);
  }
}

async function youtubeId(value: string): Promise<string | null> {
  const input = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0] ?? null;
    else if (host === "youtube.com" || host === "music.youtube.com") {
      id = url.searchParams.get("v");
      const match = url.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/);
      if (!id && match) id = match[2] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

async function listVideos(db: Db) {
  await syncIfStale(db);
  const { data, error } = await db.from("podcast_videos")
    .select("id, youtube_id, external_url, title, description, published_on, published_at, thumbnail_url, custom_thumbnail_url, duration_seconds, source, category, featured, sort_order")
    .eq("status", "published").is("archived_at", null)
    .order("featured", { ascending: false }).order("sort_order", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("published_on", { ascending: false, nullsFirst: false }).limit(200);
  if (error) throw new HttpError(500, "Nie udało się pobrać materiałów wideo.");
  return (data ?? []).map((row: any) => ({
    id: row.id, youtube_id: row.youtube_id, external_url: row.external_url,
    title: row.title, description: row.description, published_on: row.published_on,
    published_at: row.published_at, thumbnail_url: row.custom_thumbnail_url || row.thumbnail_url,
    duration_seconds: row.duration_seconds, source: row.source, category: row.category, featured: row.featured,
  })) as PublicVideo[];
}

async function getPublicChannel(db: Db) {
  const { data, error } = await db.from("youtube_source")
    .select("channel_url, channel_title").eq("id", 1).maybeSingle();
  if (error) throw new HttpError(500, "Nie udało się pobrać kanału YouTube.");
  return { url: data?.channel_url ?? null, title: data?.channel_title ?? null };
}

async function adminGetYoutubeSource(db: Db) {
  const { data, error } = await db.from("youtube_source").select("*").eq("id", 1).maybeSingle();
  if (error) throw new HttpError(500, "Nie udało się pobrać ustawień YouTube.");
  const { key, source } = await currentKey(db);
  return {
    ...(data ?? {}),
    keyConfigured: !!key,
    keyCheck: { length: key.length, hasWhitespace: /\s/.test(key), startsAIza: key.trim().startsWith("AIza"), lengthOk: key.trim().length === 39 },
    keyMasked: maskKey(key),
    keySource: source,
  };
}

async function adminSaveYoutubeKey(db: Db, actor: string, rawKey: string) {
  const key = rawKey.trim();
  try {
    await testKey(db, key);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Błąd";
    await logEvent(db, { type: "youtube_key_save", actor, objectKind: "youtube_secret", result: "failed", detail: message.slice(0, 260) });
    return { ok: false as const, error: message };
  }
  const { error } = await db.from("youtube_secret").upsert({
    id: 1, api_key: key, updated_at: new Date().toISOString(), updated_by: actor,
  });
  if (error) throw new HttpError(500, "Nie udało się zapisać klucza.");
  await logEvent(db, { type: "youtube_key_save", actor, objectKind: "youtube_secret", detail: "klucz " + maskKey(key) });
  return { ok: true as const, masked: maskKey(key) };
}

async function adminTestYoutubeKey(db: Db) {
  const { key } = await currentKey(db);
  if (!key) return { ok: false as const, error: "Brak zapisanego klucza." };
  try {
    await testKey(key);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Błąd" };
  }
}

async function adminSaveYoutubeSource(db: Db, actor: string, input: string) {
  if (!parseChannelInput(input)) throw new HttpError(400, "Nie rozpoznano kanału. Podaj adres kanału, handle (@nazwa) albo Channel ID (UC…).");
  try {
    const channel = await resolveChannel(db, input);
    const { error } = await db.from("youtube_source").update({
      ...channel, channel_input: input, status: "ok", last_error: null,
      updated_at: new Date().toISOString(), updated_by: actor,
    }).eq("id", 1);
    if (error) throw new HttpError(500, "Nie udało się zapisać kanału YouTube.");
    await logEvent(db, { type: "youtube_source_save", actor, objectKind: "youtube_source", objectId: channel.channel_id, detail: channel.channel_title });
    return channel;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Błąd";
    await db.from("youtube_source").update({
      channel_input: input, status: "error", last_error: message.slice(0, 500),
      updated_at: new Date().toISOString(), updated_by: actor,
    }).eq("id", 1);
    await logEvent(db, { type: "youtube_source_save", actor, objectKind: "youtube_source", result: "failed", detail: message.slice(0, 300) });
    throw error instanceof HttpError ? error : new HttpError(400, message);
  }
}

async function adminSetVideoStatus(db: Db, actor: string, input: z.infer<typeof VideoStatusInput>) {
  const now = new Date().toISOString();
  const patch = input.status === "archived"
    ? { status: "hidden", archived_at: now, featured: false, updated_at: now }
    : { status: input.status, archived_at: null, updated_at: now };
  const { error } = await db.from("podcast_videos").update(patch).eq("id", input.id);
  if (error) throw new HttpError(500, "Nie udało się zmienić statusu.");
  await logEvent(db, { type: "voice_video_status", actor, objectKind: "podcast_video", objectId: input.id, detail: input.status });
  return { ok: true as const };
}

async function adminUpdateVideo(db: Db, actor: string, input: z.infer<typeof VideoUpdateInput>) {
  const { data: current, error: readError } = await db.from("podcast_videos")
    .select("source, title, description, is_custom_title, is_custom_description")
    .eq("id", input.id).single();
  if (readError || !current) throw new HttpError(404, "Nie znaleziono materiału.");
  const isYoutube = current.source === "youtube";
  const patch: Record<string, unknown> = {
    custom_thumbnail_url: input.custom_thumbnail_url || null,
    category: input.category || null,
    featured: input.featured,
    sort_order: input.sort_order,
    updated_at: new Date().toISOString(),
  };
  if (isYoutube) {
    if (input.reset_title) patch.is_custom_title = false;
    else if (input.title !== current.title) { patch.title = input.title; patch.is_custom_title = true; }
    if (input.reset_description) patch.is_custom_description = false;
    else if (input.description !== current.description) { patch.description = input.description; patch.is_custom_description = true; }
  } else {
    patch.title = input.title;
    patch.description = input.description;
    if (input.published_on) {
      patch.published_on = input.published_on;
      patch.published_at = input.published_on + "T12:00:00Z";
    }
  }
  const { error } = await db.from("podcast_videos").update(patch).eq("id", input.id);
  if (error) throw new HttpError(400, error.message.includes("check") ? "Nieprawidłowe dane (sprawdź adres miniatury)." : "Nie udało się zapisać zmian.");
  await logEvent(db, { type: "voice_video_edit", actor, objectKind: "podcast_video", objectId: input.id, detail: Object.keys(patch).filter((key) => key !== "updated_at").join(",") });
  if (isYoutube && (input.reset_title || input.reset_description)) {
    await runSync(db, actor).catch(() => {});
  }
  return { ok: true as const };
}

async function adminAddManualVideo(db: Db, actor: string, input: z.infer<typeof ManualVideoInput>) {
  const youtubeVideoId = await youtubeId(input.url);
  let external: string | null = null;
  if (!youtubeVideoId) {
    try {
      const url = new URL(input.url);
      if (url.protocol !== "https:") throw new Error("https required");
      external = url.toString();
    } catch {
      throw new HttpError(400, "Podaj prawidłowy link: film YouTube albo adres zaczynający się od https://");
    }
    const { data: duplicate } = await db.from("podcast_videos").select("id").eq("external_url", external).maybeSingle();
    if (duplicate) throw new HttpError(409, "Ten materiał jest już w Głosie TNB.");
  } else {
    const { data: duplicate } = await db.from("podcast_videos").select("id").eq("youtube_id", youtubeVideoId).maybeSingle();
    if (duplicate) throw new HttpError(409, "Ten film jest już w Głosie TNB.");
  }
  const { data: row, error } = await db.from("podcast_videos").insert({
    youtube_id: youtubeVideoId, external_url: external, title: input.title, description: input.description,
    custom_thumbnail_url: input.custom_thumbnail_url || null, category: input.category || null,
    published_on: input.published_on, published_at: input.published_on + "T12:00:00Z",
    status: input.status, source: "manual",
  }).select("id").single();
  if (error || !row) throw new HttpError(500, "Nie udało się dodać materiału.");
  await logEvent(db, { type: "voice_video_add", actor, objectKind: "podcast_video", objectId: row.id, detail: (external ? "link zewnętrzny" : "youtube") + ": " + input.title.slice(0, 120) });
  return { id: row.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ message: "Niedozwolona metoda." }, 405);
  let db: Db;
  try {
    db = adminClient();
    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return json({ message: "Nieprawidłowe żądanie." }, 400);
    const input = parsed.data;
    const protectedActions = new Set([
      "adminGetYoutubeSource", "adminSaveYoutubeKey", "adminTestYoutubeKey", "adminSaveYoutubeSource",
      "adminSyncYoutube", "adminSyncIfStale", "adminListVideos", "adminSetVideoStatus", "adminUpdateVideo", "adminAddManualVideo",
    ]);
    let actor: string | null = null;
    if (protectedActions.has(input.action)) actor = (await requireAdmin(db, req)).id;
    switch (input.action) {
      case "listVideos": return json(await listVideos(db));
      case "getPublicChannel": return json(await getPublicChannel(db));
      case "adminGetYoutubeSource": return json(await adminGetYoutubeSource(db));
      case "adminSaveYoutubeKey": return json(await adminSaveYoutubeKey(db, actor!, input.data.key));
      case "adminTestYoutubeKey": return json(await adminTestYoutubeKey(db));
      case "adminSaveYoutubeSource": return json(await adminSaveYoutubeSource(db, actor!, input.data.input));
      case "adminSyncYoutube": return json(await runSync(db, actor));
      case "adminSyncIfStale": await syncIfStale(db); return json({ ok: true as const });
      case "adminListVideos": {
        const { data, error } = await db.from("podcast_videos").select("*")
          .order("featured", { ascending: false }).order("sort_order", { ascending: true })
          .order("published_at", { ascending: false, nullsFirst: false }).limit(300);
        if (error) throw new HttpError(500, "Nie udało się pobrać materiałów wideo.");
        return json((data ?? []).map((row: any) => ({ ...row, yt_thumbnail_url: row.thumbnail_url })) as AdminVideo[]);
      }
      case "adminSetVideoStatus": return json(await adminSetVideoStatus(db, actor!, input.data));
      case "adminUpdateVideo": return json(await adminUpdateVideo(db, actor!, input.data));
      case "adminAddManualVideo": return json(await adminAddManualVideo(db, actor!, input.data));
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof YtError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Wystąpił błąd serwera.";
    if (status >= 500) console.error("tnb-youtube error:", message);
    return json({ message }, status);
  }
  return json({ message: "Nieznana operacja." }, 400);
});
