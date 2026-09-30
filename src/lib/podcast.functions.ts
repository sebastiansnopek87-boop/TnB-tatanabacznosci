import { assertAdmin, logEvent } from "./admin-auth.server";
const LOG = (ctx: { userId: string }, type: string, kind: string, id?: string, result: "ok" | "failed" = "ok", detail?: string) => logEvent({ type, actor: ctx.userId, objectKind: kind, objectId: id, result, detail });

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EpisodeDetail, EpisodeMedia, PublicEpisode } from "./podcast";

// Public reads use the service role with an explicit safe column list; storage paths and
// external URLs never leave the server unless the viewer passes the access check.
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const BUCKET = "podcast-files";
type Ctx = { supabase: any; userId: string };
async function optionalUser() {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.split(".").length !== 3) return null;
  const { data } = await (await admin()).auth.getUser(token);
  return data.user ?? null;
}

const COLS = "id, slug, title, summary, description, category, access, cover_path, audio_path, external_url, duration_seconds, featured, sort_order, published_at, updated_at";
function toPublic(e: any): EpisodeDetail {
  return {
    id: e.id, slug: e.slug, title: e.title, summary: e.summary, description: e.description, category: e.category, access: e.access,
    has_cover: !!e.cover_path, has_audio: !!e.audio_path, has_external: !!e.external_url, duration_seconds: e.duration_seconds,
    featured: e.featured, published_at: e.published_at, updated_at: e.updated_at,
  };
}

export const listEpisodes = createServerFn({ method: "GET" }).handler(async (): Promise<PublicEpisode[]> => {
  const { data } = await (await admin()).from("podcast_episodes").select(COLS).eq("status", "published")
    .order("featured", { ascending: false }).order("sort_order", { ascending: true }).order("published_at", { ascending: false }).limit(300);
  return (data ?? []).map((e) => { const { description: _d, ...rest } = toPublic(e); return rest; });
});

export const getEpisode = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { data: e } = await (await admin()).from("podcast_episodes").select(COLS).eq("slug", data.slug).eq("status", "published").maybeSingle();
    return e ? toPublic(e) : null;
  });

// Returns a short-lived signed audio URL / external link only when the viewer may listen.
export const getEpisodeMedia = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<EpisodeMedia> => {
    const db = await admin();
    const { data: e } = await db.from("podcast_episodes").select("access, status, audio_path, external_url").eq("id", data.id).maybeSingle();
    if (!e || e.status !== "published") throw new Error("Nie znaleziono odcinka.");
    if (e.access !== "public") {
      const user = await optionalUser();
      if (!user) return { allowed: false, reason: "login" };
      if (e.access === "premium") {
        const [{ data: p }, { data: a }] = await Promise.all([
          db.rpc("has_role", { _user_id: user.id, _role: "premium" }),
          db.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        ]);
        if (!p && !a) return { allowed: false, reason: "premium" };
      }
    }
    let src: string | null = null;
    if (e.audio_path) {
      const { data: s } = await db.storage.from(BUCKET).createSignedUrl(e.audio_path, 60 * 60 * 3);
      src = s?.signedUrl ?? null;
    }
    return { allowed: true, src, external: e.external_url ?? null };
  });

// ---------- admin ----------
export const adminListEpisodes = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const { data, error } = await context.supabase.from("podcast_episodes")
    .select("id, slug, title, category, access, status, featured, sort_order, published_at, audio_path, external_url, cover_path")
    .order("sort_order").order("created_at", { ascending: false });
  if (error) throw new Error("Nie udało się pobrać odcinków.");
  return data as any[];
});

export const adminGetEpisode = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: e, error } = await context.supabase.from("podcast_episodes").select("*").eq("id", data.id).maybeSingle();
    if (error || !e) throw new Error("Nie znaleziono odcinka.");
    return e as any;
  });

const EpisodeInput = z.object({
  id: z.string().uuid().nullable(),
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/, "Adres może zawierać tylko małe litery, cyfry i myślniki."),
  title: z.string().trim().min(3, "Tytuł musi mieć co najmniej 3 znaki.").max(200),
  summary: z.string().trim().max(600),
  description: z.string().max(20000),
  category: z.string().regex(/^[a-z0-9_]{1,40}$/),
  access: z.enum(["public", "members", "premium"]),
  external_url: z.string().trim().max(1000).refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Adres nagrania musi zaczynać się od https://"),
  duration_seconds: z.number().int().positive().max(86400).nullable(),
  featured: z.boolean(),
  sort_order: z.number().int().min(-9999).max(9999),
  published_at: z.string().datetime({ offset: true }).nullable(),
});

export const adminSaveEpisode = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EpisodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const row = { ...rest, external_url: rest.external_url || null };
    if (row.featured) {
      await context.supabase.from("podcast_episodes").update({ featured: false }).eq("featured", true).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
    }
    const q = id
      ? context.supabase.from("podcast_episodes").update(row).eq("id", id).select("id").single()
      : context.supabase.from("podcast_episodes").insert(row).select("id").single();
    const { data: r, error } = await q;
    await LOG(context, id ? "episode_edit" : "episode_create", "episode", r?.id ?? id ?? undefined, error ? "failed" : "ok", rest.title);
    if (error) throw new Error(error.code === "23505" ? "Odcinek o takim adresie już istnieje." : "Nie udało się zapisać odcinka.");
    return { id: r.id as string };
  });

export const adminSetEpisodeStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: cur } = await context.supabase.from("podcast_episodes").select("published_at, audio_path, external_url").eq("id", data.id).maybeSingle();
    if (!cur) throw new Error("Nie znaleziono odcinka.");
    if (data.status === "published" && !cur.audio_path && !cur.external_url) throw new Error("Dodaj plik audio lub adres nagrania przed publikacją.");
    const patch: { status: string; published_at?: string } = { status: data.status };
    if (data.status === "published" && !cur.published_at) patch.published_at = new Date().toISOString();
    const { error } = await context.supabase.from("podcast_episodes").update(patch).eq("id", data.id);
    await LOG(context, `episode_${data.status}`, "episode", data.id, error ? "failed" : "ok");
    if (error) throw new Error("Nie udało się zmienić statusu.");
    return { ok: true };
  });

const AUDIO = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm"];
const IMAGES = ["image/jpeg", "image/png", "image/webp"];

// Signed upload lets the admin's browser send large audio straight to private storage.
export const adminCreateUpload = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), kind: z.enum(["audio", "cover"]), type: z.string().max(100), size: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.kind === "audio") {
      if (!AUDIO.includes(data.type)) throw new Error("Plik audio musi być w formacie MP3, M4A, AAC, OGG, WAV lub WEBM.");
      if (data.size > 200 * 1024 * 1024) throw new Error("Plik audio może mieć maksymalnie 200 MB.");
    } else {
      if (!IMAGES.includes(data.type)) throw new Error("Grafika musi być plikiem JPG, PNG lub WEBP.");
      if (data.size > 5 * 1024 * 1024) throw new Error("Grafika może mieć maksymalnie 5 MB.");
    }
    const ext = (data.type.split("/")[1] ?? "bin").replace("jpeg", "jpg").replace("mpeg", "mp3").replace("x-", "");
    const path = `${data.id}/${data.kind}-${Date.now()}.${ext}`;
    const { data: s, error } = await (await admin()).storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !s) throw new Error("Nie udało się przygotować przesyłania.");
    return { path: s.path, token: s.token };
  });

export const adminAttachFile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), kind: z.enum(["audio", "cover"]), path: z.string().max(300), type: z.string().max(100).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.path.startsWith(`${data.id}/${data.kind}-`)) throw new Error("Nieprawidłowy plik.");
    const patch = data.kind === "audio" ? { audio_path: data.path, audio_mime: data.type || null } : { cover_path: data.path };
    const { error } = await context.supabase.from("podcast_episodes").update(patch).eq("id", data.id);
    if (error) throw new Error("Nie udało się przypisać pliku.");
    return { ok: true };
  });

export const adminRemoveFile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), kind: z.enum(["audio", "cover"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch = data.kind === "audio" ? { audio_path: null, audio_mime: null } : { cover_path: null };
    const { error } = await context.supabase.from("podcast_episodes").update(patch).eq("id", data.id);
    if (error) throw new Error("Nie udało się usunąć pliku.");
    return { ok: true };
  });

export const adminPreviewAudio = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: e } = await context.supabase.from("podcast_episodes").select("audio_path").eq("id", data.id).maybeSingle();
    if (!e?.audio_path) return { src: null };
    const { data: s } = await (await admin()).storage.from(BUCKET).createSignedUrl(e.audio_path, 3600);
    return { src: s?.signedUrl ?? null };
  });
