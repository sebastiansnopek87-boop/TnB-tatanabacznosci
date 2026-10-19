export const EP_ACCESS = { public: "Publiczny", members: "Dla zalogowanych", premium: "Premium" } as const;
export type EpAccess = keyof typeof EP_ACCESS;
export const EP_STATUS = { draft: "Szkic", published: "Opublikowany", archived: "Archiwalny" } as const;
export type EpStatus = keyof typeof EP_STATUS;

export type PublicEpisode = {
  id: string; slug: string; title: string; subtitle: string; episode_number: number | null; summary: string; category: string; access: EpAccess;
  has_cover: boolean; has_audio: boolean; has_external: boolean; duration_seconds: number | null;
  featured: boolean; sort_order?: number; published_at: string | null; updated_at: string;
};
export type EpisodeDetail = PublicEpisode & { description: string };

export type EpisodeMedia =
  | { allowed: true; src: string | null; external: string | null }
  | { allowed: false; reason: "login" | "premium" };

export const coverUrl = (e: Pick<PublicEpisode, "id" | "has_cover" | "updated_at">) =>
  e.has_cover ? `/api/public/podcast-cover/${e.id}?v=${encodeURIComponent(e.updated_at)}` : null;

export const fmtDuration = (s: number | null | undefined) => {
  if (!s || !isFinite(s)) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

export const parseDuration = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const parts = t.split(":").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0) || null;
};

export const fmtDay = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" }) : "—";
