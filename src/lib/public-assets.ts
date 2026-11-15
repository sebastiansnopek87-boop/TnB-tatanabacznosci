type PublicAssetKind = "article" | "library" | "meeting" | "podcast";

const fallbackRoutes: Record<PublicAssetKind, (id: string, file?: string) => string> = {
  article: (id, file) => "/api/public/article-image/" + encodeURIComponent(id) + "/" + encodeURIComponent(file ?? ""),
  library: (id) => "/api/public/library-cover/" + encodeURIComponent(id),
  meeting: (id) => "/api/public/meeting-image/" + encodeURIComponent(id),
  podcast: (id) => "/api/public/podcast-cover/" + encodeURIComponent(id),
};

/**
 * Public image URLs use Supabase Edge Functions when the browser has the
 * project URL configured. Existing server routes remain a local/SSR fallback.
 */
export function publicAssetUrl(kind: PublicAssetKind, id: string, version?: string | null, file?: string): string {
  const base = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").replace(/\/+$/, "");
  if (!base) {
    const fallback = fallbackRoutes[kind](id, file);
    return version ? fallback + (fallback.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(version) : fallback;
  }

  const params = new URLSearchParams({ kind, id });
  if (kind === "article" && file) params.set("file", file);
  if (version) params.set("v", version);
  return base + "/functions/v1/tnb-assets?" + params.toString();
}
