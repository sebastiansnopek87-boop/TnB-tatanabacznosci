// Głos TNB ↔ YouTube Data API v3. Server-only: the key (YOUTUBE_API_KEY) never reaches the browser.
// Source of truth = one channel configured by an admin; we read only its uploads playlist.
const API = "https://www.googleapis.com/youtube/v3";
const MAX_PAGES = 4; // up to 200 newest uploads
export const STALE_MS = 30 * 60 * 1000;

export class YtError extends Error {}

/** Panel-set key (youtube_secret, service-role only) wins; env YOUTUBE_API_KEY is the fallback. */
export async function currentKey(): Promise<{ key: string; source: "panel" | "env" | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("youtube_secret").select("api_key").eq("id", 1).maybeSingle();
  if (data?.api_key) return { key: data.api_key, source: "panel" };
  const e = process.env["YOUTUBE_API_KEY"] ?? "";
  return { key: e, source: e ? "env" : null };
}

export function maskKey(k: string) {
  const t = k.trim();
  if (!t) return "";
  if (t.length <= 8) return "•".repeat(t.length);
  return `${t.slice(0, 4)}${"•".repeat(Math.max(4, t.length - 8))}${t.slice(-4)}`;
}

/** Cheapest call (1 unit) to verify a key. Throws YtError with Google's reason. */
export async function testKey(k: string) {
  await call("i18nRegions", { part: "snippet", hl: "pl" }, k);
}

async function call(path: string, params: Record<string, string>, override?: string) {
  const u = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const k = override ?? (await currentKey()).key;
  if (!k) throw new YtError("Brak klucza YouTube API — synchronizacja z YouTube nie jest skonfigurowana.");
  u.searchParams.set("key", k);
  const r = await fetch(u, { headers: { Accept: "application/json" } });
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] }; items?: unknown[]; nextPageToken?: string };
  if (!r.ok) {
    const reason = j.error?.details?.find((d) => d.reason)?.reason ?? j.error?.errors?.find((e) => e.reason)?.reason;
    throw new YtError(`YouTube API (${r.status}${reason ? `, ${reason}` : ""}): ${j.error?.message ?? "błąd"}`);
  }
  return j;
}

/** Accepts channel URL, @handle or UC… channel ID. */
export function parseChannelInput(input: string): { id?: string; handle?: string } | null {
  const s = input.trim();
  if (/^UC[A-Za-z0-9_-]{22}$/.test(s)) return { id: s };
  if (/^@[A-Za-z0-9._-]{3,100}$/.test(s)) return { handle: s };
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
    const p = u.pathname.split("/").filter(Boolean);
    if (p[0] === "channel" && p[1] && /^UC[A-Za-z0-9_-]{22}$/.test(p[1])) return { id: p[1] };
    if (p[0]?.startsWith("@")) return { handle: decodeURIComponent(p[0]) };
  } catch { /* fallthrough */ }
  return null;
}

type T = { url: string } | undefined;
type Thumbs = { maxres?: T; standard?: T; high?: T; medium?: T; default?: T };
const bestThumb = (t?: Thumbs) => t?.maxres?.url ?? t?.standard?.url ?? t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? null;

export async function resolveChannel(input: string) {
  const p = parseChannelInput(input);
  if (!p) throw new YtError("Nie rozpoznano kanału. Podaj adres kanału (https://www.youtube.com/@nazwa), handle (@nazwa) albo Channel ID (UC…).");
  const j = await call("channels", { part: "snippet,contentDetails", ...(p.id ? { id: p.id } : { forHandle: p.handle! }) });
  const c = (j.items?.[0] ?? null) as null | { id: string; snippet: { title: string; customUrl?: string; thumbnails?: Thumbs }; contentDetails: { relatedPlaylists: { uploads: string } } };
  if (!c) throw new YtError("Nie znaleziono takiego kanału YouTube.");
  return {
    channel_id: c.id,
    channel_title: c.snippet.title,
    channel_thumb: bestThumb(c.snippet.thumbnails),
    channel_url: c.snippet.customUrl ? `https://www.youtube.com/${c.snippet.customUrl}` : `https://www.youtube.com/channel/${c.id}`,
    uploads_playlist: c.contentDetails.relatedPlaylists.uploads,
  };
}

export type YtVideo = { youtube_id: string; title: string; description: string; thumbnail_url: string | null; published_at: string; duration_seconds: number | null };

function isoDuration(d?: string) {
  const m = d && /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d);
  if (!m) return null;
  return (+(m[1] ?? 0)) * 86400 + (+(m[2] ?? 0)) * 3600 + (+(m[3] ?? 0)) * 60 + (+(m[4] ?? 0));
}

export async function fetchUploads(playlist: string): Promise<YtVideo[]> {
  const ids: string[] = [];
  let page: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const j = await call("playlistItems", { part: "contentDetails", playlistId: playlist, maxResults: "50", ...(page ? { pageToken: page } : {}) });
    for (const it of (j.items ?? []) as Array<{ contentDetails: { videoId: string } }>) ids.push(it.contentDetails.videoId);
    page = j.nextPageToken; if (!page) break;
  }
  const out: YtVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await call("videos", { part: "snippet,contentDetails,status", id: ids.slice(i, i + 50).join(",") });
    for (const v of (j.items ?? []) as Array<{ id: string; snippet: { title: string; description: string; publishedAt: string; thumbnails?: Thumbs; liveBroadcastContent?: string }; contentDetails: { duration?: string }; status: { privacyStatus: string } }>) {
      if (v.status.privacyStatus !== "public" || v.snippet.liveBroadcastContent === "upcoming") continue;
      out.push({ youtube_id: v.id, title: v.snippet.title.slice(0, 200), description: v.snippet.description.slice(0, 5000),
        thumbnail_url: bestThumb(v.snippet.thumbnails), published_at: v.snippet.publishedAt, duration_seconds: isoDuration(v.contentDetails.duration) });
    }
  }
  return out;
}

/** Full sync. Rule: YouTube source fields (thumbnail, date, duration) always refresh; title/description refresh
 *  ONLY when the admin has not marked them custom (is_custom_title / is_custom_description). Admin status,
 *  featured, sort_order, category and custom_thumbnail_url are never touched. Keyed by videoId → no duplicates. */
export async function runSync(actor: string | null) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { data: src } = await db.from("youtube_source").select("*").eq("id", 1).single();
  if (!src?.uploads_playlist) throw new YtError("Najpierw zapisz i sprawdź kanał YouTube.");
  await db.from("youtube_source").update({ last_attempt_at: now }).eq("id", 1);
  const errors: string[] = [];
  try {
    const vids = await fetchUploads(src.uploads_playlist);
    const { data: existing } = await db.from("podcast_videos").select("id, youtube_id, title, description, thumbnail_url, published_at, duration_seconds, is_custom_title, is_custom_description");
    const ex = new Map((existing ?? []).map((r) => [r.youtube_id, r]));
    let added = 0, updated = 0, skipped = 0, kept = 0;
    for (const v of vids) {
      const desc = v.description.slice(0, 1000); // DB limit
      const e = ex.get(v.youtube_id);
      if (!e) {
        const { error } = await db.from("podcast_videos").insert({ youtube_id: v.youtube_id, title: v.title, description: desc, thumbnail_url: v.thumbnail_url,
          published_at: v.published_at, published_on: v.published_at.slice(0, 10), duration_seconds: v.duration_seconds, source: "youtube", synced_at: now, updated_at: now, status: "published" });
        if (error) errors.push(`${v.youtube_id}: ${error.message}`); else added++;
        continue;
      }
      const patch: Record<string, unknown> = {};
      if (!e.is_custom_title && e.title !== v.title) patch["title"] = v.title;
      if (!e.is_custom_description && e.description !== desc) patch["description"] = desc;
      if ((e.is_custom_title && e.title !== v.title) || (e.is_custom_description && e.description !== desc)) kept++;
      if (e.thumbnail_url !== v.thumbnail_url) patch["thumbnail_url"] = v.thumbnail_url;
      if (e.duration_seconds !== v.duration_seconds) patch["duration_seconds"] = v.duration_seconds;
      if (!e.published_at || new Date(e.published_at).toISOString() !== new Date(v.published_at).toISOString()) { patch["published_at"] = v.published_at; patch["published_on"] = v.published_at.slice(0, 10); }
      if (!Object.keys(patch).length) { skipped++; continue; }
      const { error } = await db.from("podcast_videos").update({ ...patch, synced_at: now, updated_at: now } as never).eq("id", e.id);
      if (error) errors.push(`${v.youtube_id}: ${error.message}`); else updated++;
    }
    const { count } = await db.from("podcast_videos").select("id", { count: "exact", head: true }).eq("source", "youtube");
    const report = { at: now, fetched: vids.length, added, updated, skipped, kept_custom: kept, errors: errors.slice(0, 20) };
    await db.from("youtube_source").update({ status: errors.length ? "error" : "ok", last_error: errors.length ? `Błędy zapisu: ${errors.length} (szczegóły w raporcie)` : null,
      last_sync_at: now, last_sync_added: added, last_sync_updated: updated, last_sync_skipped: skipped, last_sync_report: report, video_count: count ?? 0 }).eq("id", 1);
    const { logEvent } = await import("./admin-auth.server");
    await logEvent({ type: "youtube_sync", actor, objectKind: "youtube_source", objectId: src.channel_id ?? "1", result: errors.length ? "failed" : "ok", detail: `+${added} / ~${updated} / =${skipped} / błędy ${errors.length}` });
    return { added, updated, skipped, keptCustom: kept, errors: errors.length, total: count ?? 0, fetched: vids.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Nieznany błąd";
    await db.from("youtube_source").update({ status: "error", last_error: msg.slice(0, 500), last_sync_report: { at: now, fatal: msg.slice(0, 500) } }).eq("id", 1);
    throw e instanceof YtError ? e : new YtError(msg);
  }
}

/** Opportunistic sync when a visitor/admin opens Głos TNB and data is older than STALE_MS. Never throws. */
export async function syncIfStale() {
  try {
    if (!(await currentKey()).key) return;
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - STALE_MS).toISOString();
    // atomic claim: only one request per window performs the sync
    const { data } = await db.from("youtube_source").update({ last_attempt_at: new Date().toISOString() })
      .eq("id", 1).not("uploads_playlist", "is", null).or(`last_attempt_at.is.null,last_attempt_at.lt.${cutoff}`).select("id");
    if (!data?.length) return;
    await runSync(null);
  } catch (e) { console.error("youtube syncIfStale failed", e instanceof Error ? e.message : e); }
}
