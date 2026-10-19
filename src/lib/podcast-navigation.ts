import type { PublicEpisode } from "./podcast";

/** Editorial order first; equal positions follow publication chronology, not featured flags. */
export function episodeNavigation(current: PublicEpisode, catalogue: PublicEpisode[]) {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const episodes = [current, ...catalogue].filter((e) => {
    if (!e.slug || ids.has(e.id) || slugs.has(e.slug)) return false;
    ids.add(e.id);
    slugs.add(e.slug);
    return true;
  }).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || (a.published_at ?? "9999").localeCompare(b.published_at ?? "9999")
    || a.slug.localeCompare(b.slug));
  const index = episodes.findIndex((e) => e.id === current.id);
  const previous = episodes[index - 1] ?? null;
  const next = episodes[index + 1] ?? null;
  const excluded = new Set([current.id, previous?.id, next?.id]);
  const candidates = episodes.filter((e) => !excluded.has(e.id));
  const related = candidates.sort((a, b) => Number(b.category === current.category) - Number(a.category === current.category)
    || Math.abs(episodes.indexOf(a) - index) - Math.abs(episodes.indexOf(b) - index)
    || episodes.indexOf(a) - episodes.indexOf(b)).slice(0, 4);
  return { previous, next, related };
}