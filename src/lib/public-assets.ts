type PublicAssetKind = "library" | "meeting" | "podcast";

function supabaseBaseUrl(): string {
  const base = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").replace(/\/+$/, "");
  if (!base) throw new Error("Brak wymaganej konfiguracji VITE_SUPABASE_URL.");
  return base;
}

/** Public media is served only by the validating Supabase Edge Function. */
export function publicAssetUrl(kind: PublicAssetKind, id: string, version?: string | null): string {
  const url = supabaseBaseUrl() + "/functions/v1/tnb-assets?kind=" + kind + "&id=" + encodeURIComponent(id);
  return version ? url + "&v=" + encodeURIComponent(version) : url;
}

/** Public article images are served only when a published article references the file. */
export function publicArticleAssetUrl(id: string, file: string, version?: string | null): string {
  const url = supabaseBaseUrl() + "/functions/v1/tnb-articles?image=" + encodeURIComponent(id + "/" + file);
  return version ? url + "&v=" + encodeURIComponent(version) : url;
}

/** Avatar delivery remains private and validates both the viewer and community visibility. */
export function publicAvatarUrl(scope: "own" | "post" | "comment", id: string, version?: string | null): string {
  const url = supabaseBaseUrl() + "/functions/v1/tnb-media?kind=avatar&avatarKind=" + scope + "&id=" + encodeURIComponent(id);
  return version ? url + "&v=" + encodeURIComponent(version) : url;
}
