import { getSupabaseBaseUrl } from "@/lib/supabase-url";

type PublicAssetKind = "library" | "meeting" | "podcast";

/**
 * Public image URLs use the Supabase Edge Function when the browser has the
 * project URL configured. The local route remains as an SSR migration fallback.
 */
export function publicAssetUrl(kind: PublicAssetKind, id: string, version?: string | null): string {
  const base = getSupabaseBaseUrl();
  const url = base + "/functions/v1/tnb-assets?kind=" + kind + "&id=" + encodeURIComponent(id);

  return version ? url + (url.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(version) : url;
}

/** Public article images are served only when the published article references the requested file. */
export function publicArticleAssetUrl(id: string, file: string, version?: string | null): string {
  const base = getSupabaseBaseUrl();
  const url = base + "/functions/v1/tnb-articles?image=" + encodeURIComponent(id + "/" + file);

  return version ? url + (url.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(version) : url;
}

/** Avatar assets stay private in Storage and are served by tnb-media after checking the viewer and post visibility. */
export function publicAvatarUrl(scope: "own" | "post" | "comment", id: string, version?: string | null): string {
  const base = getSupabaseBaseUrl();
  const url = base + "/functions/v1/tnb-media?kind=avatar&avatarKind=" + scope + "&id=" + encodeURIComponent(id);

  return version ? url + (url.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(version) : url;
}
