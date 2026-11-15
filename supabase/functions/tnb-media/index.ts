import { createClient } from "@supabase/supabase-js";
import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";

const UUID = /^[0-9a-f-]{36}$/i;
const ARTICLE_IMAGE = /^[a-z0-9-]+\.(jpg|png|webp)$/;
const CORS = new Headers({
  ...supabaseCorsHeaders,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "X-Content-Type-Options": "nosniff",
});
type MediaKind = "library-cover" | "meeting-image" | "podcast-cover" | "article-image" | "avatar";

function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const value = JSON.parse(raw);
      if (typeof value === "string") return value;
      if (value && typeof value.default === "string") return value.default;
    } catch {
      return raw;
    }
  }
  return null;
}

function createSupabaseFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if ((apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + apiKey) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function client() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Media backend is not configured.");
  return createClient(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
function denied() {
  return new Response("Not found", { status: 404, headers: { ...Object.fromEntries(CORS), "Cache-Control": "no-store" } });
}

function image(blob: Blob, cache = "public, max-age=3600") {
  return new Response(blob, {
    status: 200,
    headers: {
      ...Object.fromEntries(CORS),
      "Content-Type": blob.type || "image/jpeg",
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function serveLibraryCover(db: ReturnType<typeof client>, id: string) {
  if (!UUID.test(id)) return denied();
  const { data: item } = await db.from("library_items").select("cover_url, status").eq("id", id).maybeSingle();
  if (!item?.cover_url || item.status !== "published") return denied();
  const { data: blob, error } = await db.storage.from("library-files").download(item.cover_url);
  return error || !blob ? denied() : image(blob);
}

async function serveMeetingImage(db: ReturnType<typeof client>, id: string) {
  if (!UUID.test(id)) return denied();
  const { data: meeting } = await db.from("meetings").select("image_url, status").eq("id", id).maybeSingle();
  if (!meeting?.image_url || meeting.status === "draft") return denied();
  const { data: blob, error } = await db.storage.from("meeting-images").download(meeting.image_url);
  return error || !blob ? denied() : image(blob);
}

async function servePodcastCover(db: ReturnType<typeof client>, id: string) {
  if (!UUID.test(id)) return denied();
  const { data: episode } = await db.from("podcast_episodes").select("cover_path, status").eq("id", id).maybeSingle();
  if (!episode?.cover_path || episode.status !== "published") return denied();
  const { data: blob, error } = await db.storage.from("podcast-files").download(episode.cover_path);
  return error || !blob ? denied() : image(blob);
}

async function serveArticleImage(db: ReturnType<typeof client>, id: string, name: string) {
  if (!UUID.test(id) || !ARTICLE_IMAGE.test(name)) return denied();
  const { data: article } = await db.from("articles").select("status, published_at, cover, sections").eq("id", id).maybeSingle();
  const released = article?.status === "published" && !!article.published_at && new Date(article.published_at) <= new Date();
  const referenced = article && (article.cover === name
    || (Array.isArray(article.sections) && article.sections.some((section: any) => section?.image === name)));
  if (!released || !referenced) return denied();
  const { data: blob, error } = await db.storage.from("article-images").download(`${id}/${name}`);
  return error || !blob ? denied() : image(blob);
}

async function serveAvatar(db: ReturnType<typeof client>, req: Request, kind: string, id: string) {
  if (!UUID.test(id) || !["own", "post", "comment"].includes(kind)) return denied();
  let viewer: string | null = null;
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (token) {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return denied();
    viewer = data.user.id;
  }

  let owner: string | null = null;
  if (kind === "own") {
    if (viewer !== id) return denied();
    owner = viewer;
  } else {
    let postId = id;
    if (kind === "comment") {
      const { data: comment } = await db.from("community_comments").select("post_id, author_id").eq("id", id).maybeSingle();
      if (!comment) return denied();
      postId = comment.post_id;
      owner = comment.author_id;
    }
    const { data: post } = await db.from("community_posts").select("author_id, status, visibility").eq("id", postId).maybeSingle();
    if (!post) return denied();
    if (post.status !== "published") {
      if (!viewer) return denied();
      const { data: isAdmin } = await db.rpc("has_role", { _user_id: viewer, _role: "admin" });
      if (viewer !== post.author_id && !isAdmin) return denied();
    } else if (post.visibility !== "public" && !viewer) {
      return denied();
    }
    if (kind === "post") owner = post.author_id;
  }

  if (!owner) return denied();
  const { data: avatar } = await db.from("user_avatars").select("object_path").eq("user_id", owner).maybeSingle();
  if (!avatar || typeof avatar.object_path !== "string" || !avatar.object_path.startsWith(`avatars/${owner}/`)) return denied();
  const { data: blob, error } = await db.storage.from("media").download(avatar.object_path);
  return !blob || error ? denied() : new Response(blob, {
    status: 200,
    headers: { ...Object.fromEntries(CORS), "Content-Type": "image/webp", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: CORS });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as MediaKind | null;
  const id = url.searchParams.get("id") ?? "";
  try {
    const db = client();
    switch (kind) {
      case "library-cover": return await serveLibraryCover(db, id);
      case "meeting-image": return await serveMeetingImage(db, id);
      case "podcast-cover": return await servePodcastCover(db, id);
      case "article-image": return await serveArticleImage(db, id, url.searchParams.get("name") ?? "");
      case "avatar": return await serveAvatar(db, req, url.searchParams.get("avatarKind") ?? "", id);
      default: return denied();
    }
  } catch {
    return denied();
  }
});
