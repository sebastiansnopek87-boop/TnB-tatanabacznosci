import { createClient } from "@supabase/supabase-js";
import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { decode, encode, getWebpInfo, parseRiff } from "@stacksjs/ts-webp";

const MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 384;
const CORS = new Headers({
  ...supabaseCorsHeaders,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if ((apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + apiKey) headers.delete("Authorization");
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function admin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Backend unavailable");
  return createClient(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

async function userId(db: ReturnType<typeof admin>, request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const parts = authorization.trim().split(/\s+/);
  const token = parts.length === 2 && parts[0].toLowerCase() === "bearer" ? parts[1] : null;
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed", message: "Niedozwolona metoda." }, 405);

  try {
    const db = admin();
    const uid = await userId(db, req);
    if (!uid) return json({ error: "unauthorized", message: "Zaloguj się ponownie." }, 401);

    const action = new URL(req.url).searchParams.get("action");
    if (action === "save") {
      const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (contentType !== "image/webp") return json({ error: "invalid_image", message: "Wybierz obraz WebP." }, 400);
      const declared = Number(req.headers.get("content-length") ?? 0);
      if (declared > MAX_BYTES) return json({ error: "image_too_large", message: "Obraz może mieć maksymalnie 5 MB." }, 413);

      const bytes = new Uint8Array(await req.arrayBuffer());
      if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return json({ error: "image_too_large", message: "Obraz może mieć maksymalnie 5 MB." }, 413);

      let normalized: Uint8Array;
      try {
        const info = getWebpInfo(parseRiff(bytes));
        if (info.width !== AVATAR_SIZE || info.height !== AVATAR_SIZE || info.hasAnimation) {
          return json({ error: "invalid_dimensions", message: "Avatar musi mieć 384 × 384 px i nie może być animowany." }, 400);
        }
        const decoded = decode(bytes);
        if (decoded.width !== AVATAR_SIZE || decoded.height !== AVATAR_SIZE) return json({ error: "invalid_dimensions", message: "Nieprawidłowe wymiary avatara." }, 400);
        normalized = encode(decoded);
        if (!normalized.byteLength || normalized.byteLength > MAX_BYTES) {
          return json({ error: "image_too_large", message: "Obraz może mieć maksymalnie 5 MB." }, 413);
        }
      } catch {
        return json({ error: "invalid_image", message: "Nie można odczytać obrazu WebP." }, 400);
      }

      const path = `avatars/${uid}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await db.storage.from("media").upload(path, normalized, { contentType: "image/webp", upsert: false });
      if (uploadError) return json({ error: "upload_failed", message: "Nie udało się przesłać avatara." }, 500);
      const { error: saveError } = await db.from("user_avatars").upsert({ user_id: uid, object_path: path, updated_at: new Date().toISOString() });
      if (saveError) {
        await db.storage.from("media").remove([path]);
        return json({ error: "save_failed", message: "Nie udało się zapisać avatara." }, 500);
      }
      return json({ ok: true });
    }

    if (action === "remove") {
      const { error } = await db.from("user_avatars").delete().eq("user_id", uid);
      if (error) return json({ error: "remove_failed", message: "Nie udało się usunąć avatara." }, 500);
      return json({ ok: true });
    }

    return json({ error: "unknown_action", message: "Nieznana operacja." }, 400);
  } catch {
    return json({ error: "internal_error", message: "Wystąpił błąd serwera." }, 500);
  }
});
