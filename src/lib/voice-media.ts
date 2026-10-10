// Głos TNB unified view: a READ-ONLY aggregation of existing sources (podcast_episodes, podcast_videos,
// instagram_media). Nothing is copied into another table; TikTok/Spotify are not sources (links only).
import type { PublicEpisode } from "./podcast";
import { coverUrl } from "./podcast";
import type { PublicReel, PublicVideo } from "./voice.functions";
import { ytThumb } from "./voice";

export type MediaSource = "podcast" | "youtube" | "manual" | "instagram";
export const SOURCE_LABEL: Record<MediaSource, string> = { podcast: "Podcast i audio", youtube: "YouTube", manual: "Materiały dodane", instagram: "Instagram" };

export type MediaItem = {
  key: string; source: MediaSource; title: string; date: string | null; duration: number | null; summary: string; thumb: string | null;
  cta: "ODTWÓRZ" | "OBEJRZYJ" | "POSŁUCHAJ" | "PRZEJDŹ DO INSTAGRAMA" | "OTWÓRZ MATERIAŁ";
  action: { kind: "episode"; slug: string } | { kind: "video"; id: string } | { kind: "external"; href: string };
  locked?: boolean;
};

export function buildMedia(eps: PublicEpisode[], vids: PublicVideo[], reels: PublicReel[]): MediaItem[] {
  const out: MediaItem[] = [];
  for (const e of eps) out.push({
    key: `p-${e.id}`, source: "podcast", title: (e.episode_number ? `${String(e.episode_number).padStart(2, "0")}. ` : "") + e.title,
    date: e.published_at, duration: e.duration_seconds, summary: e.summary, thumb: coverUrl(e),
    cta: e.has_audio || e.has_external ? "POSŁUCHAJ" : "OTWÓRZ MATERIAŁ", action: { kind: "episode", slug: e.slug }, locked: e.access !== "public",
  });
  for (const v of vids) {
    const external = !v.youtube_id && v.external_url ? v.external_url : null;
    out.push({
      key: `v-${v.id}`, source: v.source === "manual" ? "manual" : "youtube", title: v.title, date: v.published_at ?? v.published_on,
      duration: v.duration_seconds, summary: v.description, thumb: v.thumbnail_url || (v.youtube_id ? ytThumb(v.youtube_id) : null),
      cta: external ? "OTWÓRZ MATERIAŁ" : "OBEJRZYJ",
      action: external ? { kind: "external", href: external } : { kind: "video", id: v.id },
    });
  }
  for (const r of reels) out.push({
    key: `i-${r.id}`, source: "instagram", title: (r.caption ?? "").split("\n")[0]?.slice(0, 120) || "Instagram", date: r.posted_at,
    duration: null, summary: r.caption ?? "", thumb: r.thumbnail_url, cta: "PRZEJDŹ DO INSTAGRAMA", action: { kind: "external", href: r.permalink },
  });
  return out.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
}
