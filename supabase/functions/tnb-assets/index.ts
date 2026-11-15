import { createClient } from "@supabase/supabase-js";

type PublicAssetKind = "article" | "library" | "meeting" | "podcast";
type PublicAsset = {
  bucket: "article-images" | "library-files" | "meeting-images" | "podcast-files";
  path: string;
  contentType: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const CORS_HEADERS = new Headers({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Max-Age": "86400",
  "X-Content-Type-Options": "nosniff",
});

function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed.default === "string") return parsed.default;
    } catch {
      return raw;
    }
  }
  return null;
}

function createSupabaseFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (
      (apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_")) &&
      headers.get("Authorization") === "Bearer " + apiKey
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secret = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) throw new Error("Supabase runtime configuration is incomplete");
  return createClient(url, secret, {
    global: { fetch: createSupabaseFetch(secret) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function safeImagePath(value: unknown): { path: string; contentType: string } | null {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 400 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)
  ) {
    return null;
  }

  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;

  const extension = parts[parts.length - 1]?.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[extension];
  return contentType ? { path: value, contentType } : null;
}

async function findPublicAsset(
  db: ReturnType<typeof createAdminClient>,
  kind: PublicAssetKind,
  id: string,
  file?: string,
): Promise<PublicAsset | null> {
  if (kind === "article") {
    if (!file || !/^[a-z0-9-]+\\.(jpg|png|webp)$/.test(file)) return null;
    const { data, error } = await db
      .from("articles")
      .select("status, published_at, cover, sections")
      .eq("id", id)
      .maybeSingle();
    const publishedAt = typeof data?.published_at === "string" ? Date.parse(data.published_at) : NaN;
    if (error || !data || data.status !== "published" || !Number.isFinite(publishedAt) || publishedAt > Date.now()) return null;
    const used = data.cover === file || (Array.isArray(data.sections) && data.sections.some((section: unknown) => {
      if (!section || typeof section !== "object") return false;
      return (section as Record<string, unknown>).image === file;
    }));
    if (!used) return null;
    const image = safeImagePath(`${id}/${file}`);
    return image ? { bucket: "article-images", ...image } : null;
  }

  if (kind === "library") {
    const { data, error } = await db
      .from("library_items")
      .select("cover_url, status")
      .eq("id", id)
      .maybeSingle();
    if (error || !data || data.status !== "published") return null;
    const image = safeImagePath(data.cover_url);
    return image ? { bucket: "library-files", ...image } : null;
  }

  if (kind === "meeting") {
    const { data, error } = await db
      .from("meetings")
      .select("image_url, status")
      .eq("id", id)
      .maybeSingle();
    // Keep the existing public endpoint's behavior: draft meetings are hidden.
    if (error || !data || data.status === "draft") return null;
    const image = safeImagePath(data.image_url);
    return image ? { bucket: "meeting-images", ...image } : null;
  }

  const { data, error } = await db
    .from("podcast_episodes")
    .select("cover_path, status")
    .eq("id", id)
    .maybeSingle();
  if (error || !data || data.status !== "published") return null;
  const image = safeImagePath(data.cover_path);
  return image ? { bucket: "podcast-files", ...image } : null;
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  CORS_HEADERS.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function notFound(): Response {
  return withCors(new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } }));
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));
  if (request.method !== "GET") {
    return withCors(new Response("Method not allowed", { status: 405, headers: { Allow: "GET, OPTIONS" } }));
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");
  const file = url.searchParams.get("file") ?? undefined;
  if (
    (kind !== "article" && kind !== "library" && kind !== "meeting" && kind !== "podcast") ||
    !id ||
    !UUID.test(id) ||
    (kind === "article" && (!file || !/^[a-z0-9-]+\\.(jpg|png|webp)$/.test(file)))
  ) {
    return notFound();
  }

  try {
    const db = createAdminClient();
    const asset = await findPublicAsset(db, kind, id, file);
    if (!asset) return notFound();

    const { data: blob, error } = await db.storage.from(asset.bucket).download(asset.path);
    if (error || !blob) return notFound();

    return withCors(new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
      },
    }));
  } catch {
    console.error("tnb-assets request failed");
    return notFound();
  }
});
