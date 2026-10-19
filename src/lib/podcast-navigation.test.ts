import { describe, expect, it } from "vitest";
import { episodeNavigation } from "./podcast-navigation";
import type { PublicEpisode } from "./podcast";

const ep = (n: number, patch: Partial<PublicEpisode> = {}): PublicEpisode => ({
  id: `id-${n}`, slug: `odcinek-${n}`, title: `Odcinek ${n}`, subtitle: "", episode_number: n,
  summary: "", category: "ojcostwo", access: "public", has_cover: false, has_audio: true,
  has_external: false, duration_seconds: 120, featured: false, sort_order: 0,
  published_at: `2026-10-${String(n).padStart(2, "0")}T12:00:00Z`, updated_at: "2026-10-19", ...patch,
});
const catalogue = Array.from({ length: 8 }, (_, i) => ep(i + 1));
describe("podcast navigation", () => {
  it("opens previous and next by actual published chronology", () => {
    const result = episodeNavigation(ep(4), [...catalogue].reverse());
    expect(result.previous?.slug).toBe("odcinek-3");
    expect(result.next?.slug).toBe("odcinek-5");
  });
  it("honours the existing administrator order, ignoring featured promotion", () => {
    const result = episodeNavigation(ep(4), [ep(1, { sort_order: 2 }), ep(2, { sort_order: -1, featured: true })]);
    expect(result.previous?.id).toBe("id-2");
    expect(result.next?.id).toBe("id-1");
  });
  it("returns four real recommendations without current or adjacent duplicates", () => {
    const result = episodeNavigation(ep(4), [...catalogue, ep(1), ep(20, { slug: "odcinek-2" })]);
    expect(result.related).toHaveLength(4);
    const ids = [result.previous?.id, result.next?.id, ...result.related.map((e) => e.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("id-4");
    expect(result.related.every((e) => catalogue.some((original) => original.id === e.id))).toBe(true);
  });
  it("prefers a matching category over closer unrelated episodes", () => {
    const result = episodeNavigation(ep(4), [ep(1), ep(2, { category: "inne" }), ep(3), ep(5), ep(6, { category: "inne" }), ep(7), ep(8)]);
    expect(result.related.map((e) => e.id)).toEqual(["id-1", "id-7", "id-8", "id-2"]);
  });
  it("has no previous on the first episode", () => {
    expect(episodeNavigation(ep(1), catalogue).previous).toBeNull();
    expect(episodeNavigation(ep(1), catalogue).next?.id).toBe("id-2");
  });
  it("has no next on the last episode", () => {
    expect(episodeNavigation(ep(8), catalogue).next).toBeNull();
    expect(episodeNavigation(ep(8), catalogue).previous?.id).toBe("id-7");
  });
  it("handles a single episode without fake recommendations", () => {
    expect(episodeNavigation(ep(1), [ep(1)])).toEqual({ previous: null, next: null, related: [] });
  });
  it("keeps restricted episodes metadata-only with unchanged access labels", () => {
    const result = episodeNavigation(ep(1), [ep(2, { access: "members" }), ep(3, { access: "premium" })]);
    expect(result.next?.access).toBe("members");
    expect(result.related[0]?.access).toBe("premium");
    for (const e of [result.next, ...result.related]) {
      expect(e).not.toHaveProperty("audio_path");
      expect(e).not.toHaveProperty("external_url");
      expect(e).not.toHaveProperty("src");
    }
  });
});