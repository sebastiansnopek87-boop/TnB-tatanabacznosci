export const SUBMISSION_STATUSES = ["new", "review", "contacted", "invited", "recorded", "rejected", "archived"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export const SUBMISSION_LABEL: Record<SubmissionStatus, string> = {
  new: "Nowe", review: "W trakcie analizy", contacted: "Skontaktowano", invited: "Zaproszony",
  recorded: "Nagrany", rejected: "Odrzucone", archived: "Zarchiwizowane",
};
export const VIDEO_STATUS = { draft: "Szkic", published: "Opublikowany", hidden: "Ukryty" } as const;

/** Extracts the 11-char YouTube video id from common URL shapes. */
export function youtubeId(url: string): string | null {
  const u = url.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(u)) return u;
  try {
    const p = new URL(u);
    const host = p.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = p.pathname.slice(1).split("/")[0] ?? null;
    else if (host === "youtube.com" || host === "music.youtube.com") {
      id = p.searchParams.get("v");
      const m = p.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/);
      if (!id && m) id = m[2] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
export const ytUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
