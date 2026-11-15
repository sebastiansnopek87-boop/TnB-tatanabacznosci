type PublicAssetKind = "library" | "meeting" | "podcast";

const fallbackRoutes: Record<PublicAssetKind, (id: string) => string> = {
  library: (id) => "/api/public/library-cover/" + encodeURIComponent(id),
  meeting: (id) => "/api/public/meeting-image/" + encodeURIComponent(id),
  podcast: (id) => "/api/public/podcast-cover/" + encodeURIComponent(id),
};

/**
 * Public image URLs use the Supabase Edge Function when the browser has the
 * project URL configured. The local route remains as an SSR migration fallback.
 */
export function publicAssetUrl(kind: PublicAssetKind, id: string, version?: string | null): string {
  const base = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").replace(/\/+$/, "");
  const url = base
    ? base + "/functions/v1/tnb-assets?kind=" + kind + "&id=" + encodeURIComponent(id)
    : fallbackRoutes[kind](id);

  return version ? url + (url.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(version) : url;
}
