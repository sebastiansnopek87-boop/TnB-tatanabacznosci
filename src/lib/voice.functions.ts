// Głos TNB: extension of the Podcast module — YouTube channel sync (youtube.server.ts) and guest
// story submissions. Episodes stay in podcast.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logEvent } from "./admin-auth.server";
import { SUBMISSION_STATUSES } from "./voice";

export type PublicVideo = { id: string; youtube_id: string; title: string; description: string; published_on: string | null; published_at: string | null; thumbnail_url: string | null; duration_seconds: number | null; source: "manual" | "youtube"; category: string | null; featured: boolean };

function anonDb() {
  return import("@supabase/supabase-js").then(({ createClient }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    return createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      } },
    });
  });
}

/** Published, non-archived videos (YouTube-synced + admin-added). Custom thumbnail wins over the YouTube one. */
export const listVideos = createServerFn({ method: "GET" }).handler(async () => {
  const { syncIfStale } = await import("./youtube.server");
  await syncIfStale();
  const db = await anonDb();
  const { data, error } = await db.from("podcast_videos")
    .select("id, youtube_id, title, description, published_on, published_at, thumbnail_url, custom_thumbnail_url, duration_seconds, source, category, featured, sort_order")
    .eq("status", "published").is("archived_at", null)
    .order("featured", { ascending: false }).order("sort_order", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false }).order("published_on", { ascending: false, nullsFirst: false }).limit(200);
  if (error) throw new Error("Nie udało się pobrać materiałów wideo.");
  return (data ?? []).map(({ custom_thumbnail_url, sort_order: _s, ...r }) => ({ ...r, thumbnail_url: custom_thumbnail_url || r.thumbnail_url })) as PublicVideo[];
});

/** Public, safe fields only: official channel link for the "Odwiedź kanał" button. */
export const getPublicChannel = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("youtube_source").select("channel_url, channel_title").eq("id", 1).maybeSingle();
  return { url: data?.channel_url ?? null, title: data?.channel_title ?? null };
});

// ---------- admin: YouTube source ----------
export const adminGetYoutubeSource = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("youtube_source").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error("Nie udało się pobrać ustawień YouTube.");
    const yt = await import("./youtube.server");
    const { key: k, source } = await yt.currentKey();
    const keyCheck = {
      length: k.length,
      hasWhitespace: /\s/.test(k),
      startsAIza: k.trim().startsWith("AIza"),
      lengthOk: k.trim().length === 39,
    };
    // Only a masked preview ever leaves the server.
    return { ...data, keyConfigured: !!k, keyCheck, keyMasked: yt.maskKey(k), keySource: source };
  });

/** Replace the YouTube API key: tested against Google first, saved only when valid. */
export const adminSaveYoutubeKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().trim().min(20, "Klucz jest za krótki").max(100).regex(/^[A-Za-z0-9_-]+$/, "Klucz zawiera niedozwolone znaki (spacje, cudzysłowy?)") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const yt = await import("./youtube.server");
    try { await yt.testKey(data.key); }
    catch (e) {
      const m = e instanceof Error ? e.message : "Błąd";
      await logEvent({ type: "youtube_key_save", actor: context.userId, objectKind: "youtube_secret", result: "failed", detail: m.slice(0, 300) });
      return { ok: false as const, error: m };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("youtube_secret").upsert({ id: 1, api_key: data.key, updated_at: new Date().toISOString(), updated_by: context.userId });
    if (error) throw new Error("Nie udało się zapisać klucza.");
    await logEvent({ type: "youtube_key_save", actor: context.userId, objectKind: "youtube_secret", detail: `klucz ${yt.maskKey(data.key)}` });
    return { ok: true as const, masked: yt.maskKey(data.key) };
  });

/** Test the currently stored key without changing anything. */
export const adminTestYoutubeKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const yt = await import("./youtube.server");
    const { key } = await yt.currentKey();
    if (!key) return { ok: false as const, error: "Brak zapisanego klucza." };
    try { await yt.testKey(key); return { ok: true as const }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "Błąd" }; }
  });

export const adminSaveYoutubeSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ input: z.string().trim().min(2, "Podaj kanał").max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const yt = await import("./youtube.server");
    if (!yt.parseChannelInput(data.input)) throw new Error("Nie rozpoznano kanału. Podaj adres kanału (https://www.youtube.com/@nazwa), handle (@nazwa) albo Channel ID (UC…).");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const c = await yt.resolveChannel(data.input);
      await supabaseAdmin.from("youtube_source").update({ ...c, channel_input: data.input, status: "ok", last_error: null, updated_at: new Date().toISOString(), updated_by: context.userId }).eq("id", 1);
      await logEvent({ type: "youtube_source_save", actor: context.userId, objectKind: "youtube_source", objectId: c.channel_id, detail: c.channel_title });
      return c;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Błąd";
      await supabaseAdmin.from("youtube_source").update({ channel_input: data.input, status: "error", last_error: msg.slice(0, 500), updated_at: new Date().toISOString(), updated_by: context.userId }).eq("id", 1);
      await logEvent({ type: "youtube_source_save", actor: context.userId, objectKind: "youtube_source", result: "failed", detail: msg });
      throw new Error(msg);
    }
  });

export const adminSyncYoutube = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runSync } = await import("./youtube.server");
    try { return await runSync(context.userId); }
    catch (e) { const m = e instanceof Error ? e.message : "Błąd synchronizacji"; await logEvent({ type: "youtube_sync", actor: context.userId, result: "failed", detail: m }); throw new Error(m); }
  });

/** Called when an admin opens the panel: syncs only if data is older than 30 min. */
export const adminSyncIfStale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { syncIfStale } = await import("./youtube.server");
    await syncIfStale();
    return { ok: true as const };
  });

// ---------- admin: videos (YouTube-synced + manually added) ----------
export type AdminVideo = PublicVideo & { status: "draft" | "published" | "hidden"; synced_at: string | null; sort_order: number;
  is_custom_title: boolean; is_custom_description: boolean; custom_thumbnail_url: string | null; archived_at: string | null; yt_thumbnail_url: string | null };

export const adminListVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("podcast_videos").select("*")
      .order("featured", { ascending: false }).order("sort_order", { ascending: true }).order("published_at", { ascending: false, nullsFirst: false }).limit(300);
    if (error) throw new Error("Nie udało się pobrać materiałów wideo.");
    return (data ?? []).map((r) => ({ ...r, yt_thumbnail_url: r.thumbnail_url })) as unknown as AdminVideo[];
  });

/** Status change; "archived" = hidden + archived_at (kept, never public, excluded from "najnowszy"). */
export const adminSetVideoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "hidden", "archived"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const now = new Date().toISOString();
    const patch = data.status === "archived" ? { status: "hidden", archived_at: now, featured: false } : { status: data.status, archived_at: null };
    const { error } = await context.supabase.from("podcast_videos").update({ ...patch, updated_at: now }).eq("id", data.id);
    if (error) throw new Error("Nie udało się zmienić statusu.");
    await logEvent({ type: "voice_video_status", actor: context.userId, objectKind: "podcast_video", objectId: data.id, detail: data.status });
    return { ok: true as const };
  });

const httpsOpt = z.string().trim().max(500).refine((v) => !v || /^https:\/\//.test(v), "Adres musi zaczynać się od https://");

/** Edit metadata. Editing a YouTube title/description marks it custom so the next sync keeps it;
 *  `reset_title`/`reset_description` give the field back to YouTube. */
export const adminUpdateVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), title: z.string().trim().min(1, "Podaj tytuł").max(200), description: z.string().trim().max(1000, "Maksymalnie 1000 znaków"),
    custom_thumbnail_url: httpsOpt, category: z.string().trim().max(60), featured: z.boolean(), sort_order: z.number().int().min(-9999).max(9999),
    published_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
    reset_title: z.boolean().default(false), reset_description: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: cur, error: e1 } = await context.supabase.from("podcast_videos").select("source, title, description, is_custom_title, is_custom_description").eq("id", data.id).single();
    if (e1 || !cur) throw new Error("Nie znaleziono materiału.");
    const yt = cur.source === "youtube";
    const patch: Record<string, unknown> = {
      custom_thumbnail_url: data.custom_thumbnail_url || null, category: data.category || null, featured: data.featured, sort_order: data.sort_order, updated_at: new Date().toISOString(),
    };
    if (yt) {
      if (data.reset_title) patch.is_custom_title = false;
      else if (data.title !== cur.title) { patch.title = data.title; patch.is_custom_title = true; }
      if (data.reset_description) patch.is_custom_description = false;
      else if (data.description !== cur.description) { patch.description = data.description; patch.is_custom_description = true; }
    } else {
      patch.title = data.title; patch.description = data.description;
      if (data.published_on) { patch.published_on = data.published_on; patch.published_at = `${data.published_on}T12:00:00Z`; }
    }
    const { error } = await context.supabase.from("podcast_videos").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message.includes("check") ? "Nieprawidłowe dane (sprawdź adres miniatury)." : "Nie udało się zapisać zmian.");
    await logEvent({ type: "voice_video_edit", actor: context.userId, objectKind: "podcast_video", objectId: data.id, detail: Object.keys(patch).filter((k) => k !== "updated_at").join(",") });
    if (yt && (data.reset_title || data.reset_description)) {
      const { runSync } = await import("./youtube.server");
      await runSync(context.userId).catch(() => {});
    }
    return { ok: true as const };
  });

/** Admin adds a material manually (a YouTube video, e.g. from a guest's channel). Stored as source=manual. */
export const adminAddManualVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    url: z.string().trim().min(5).max(300), title: z.string().trim().min(1, "Podaj tytuł").max(200), description: z.string().trim().max(1000),
    custom_thumbnail_url: httpsOpt, category: z.string().trim().max(60), published_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę"),
    status: z.enum(["draft", "published"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { youtubeId } = await import("./voice");
    const id = youtubeId(data.url);
    if (!id) throw new Error("To nie jest prawidłowy link do filmu YouTube. Obecnie ręcznie można dodać tylko film z YouTube.");
    const { data: dup } = await context.supabase.from("podcast_videos").select("id").eq("youtube_id", id).maybeSingle();
    if (dup) throw new Error("Ten film jest już w Głosie TNB.");
    const { data: row, error } = await context.supabase.from("podcast_videos").insert({
      youtube_id: id, title: data.title, description: data.description, custom_thumbnail_url: data.custom_thumbnail_url || null, category: data.category || null,
      published_on: data.published_on, published_at: `${data.published_on}T12:00:00Z`, status: data.status, source: "manual",
    }).select("id").single();
    if (error || !row) throw new Error("Nie udało się dodać materiału.");
    await logEvent({ type: "voice_video_add", actor: context.userId, objectKind: "podcast_video", objectId: row.id, detail: data.title.slice(0, 120) });
    return { id: row.id };
  });

// ---------- public: story submission ----------
const opt = (max: number) => z.string().trim().max(max, `Maksymalnie ${max} znaków`);
export const storySchema = z.object({
  name: z.string().trim().min(1, "Podaj imię i nazwisko").max(120, "Maksymalnie 120 znaków"),
  email: z.string().trim().email("Podaj poprawny adres e-mail").max(255),
  phone: z.string().trim().max(40, "Maksymalnie 40 znaków").regex(/^[0-9+()\s-]*$/, "Numer może zawierać tylko cyfry, spacje i znaki + ( ) -"),
  about: opt(1000),
  topic: z.string().trim().min(1, "Napisz, o czym chcesz porozmawiać").max(1000, "Maksymalnie 1000 znaków"),
  story: z.string().trim().min(20, "Opowiedz swoją historię (co najmniej 20 znaków)").max(5000, "Maksymalnie 5000 znaków"),
  why: opt(2000),
  profile_url: opt(500),
  consent: z.boolean().refine((v) => v === true, "Zaznacz zgodę na kontakt"),
});

export const submitVoiceStory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => storySchema.extend({ website: z.string().max(0).optional().default(""), elapsedMs: z.number().int().nonnegative() }).parse(d))
  .handler(async ({ data }) => {
    if (data.website || data.elapsedMs < 2500) throw new Error("Zgłoszenie odrzucone przez filtr antyspamowy.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("voice_submissions").insert({
      name: data.name, email: data.email, phone: data.phone || null, about: data.about, topic: data.topic,
      story: data.story, why: data.why, profile_url: data.profile_url || null, contact_consent: true,
    }).select("id").single();
    if (error || !row) { console.error("voice submission insert failed", error?.message); throw new Error("Nie udało się zapisać zgłoszenia."); }
    const { dispatch } = await import("./notifications.server");
    await dispatch({ event: "voice_submission_admin", idempotencyKey: `voice_submission_admin-${row.id}`, relatedId: row.id,
      vars: { imie: data.name, email: data.email, temat_wiadomosci: data.topic.slice(0, 120), link_do_panelu: "https://tatanabacznosci.pl/admin/zgloszenia-glos" } });
    return { ok: true as const };
  });

// ---------- admin: submissions ----------
export const adminListSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("voice_submissions").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error("Nie udało się pobrać zgłoszeń.");
    return data as Array<{ id: string; name: string; email: string; phone: string | null; about: string; topic: string; story: string; why: string;
      profile_url: string | null; status: (typeof SUBMISSION_STATUSES)[number]; admin_note: string; created_at: string; updated_at: string }>;
  });

export const adminUpdateSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(SUBMISSION_STATUSES), admin_note: z.string().max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("voice_submissions")
      .update({ status: data.status, admin_note: data.admin_note, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error("Nie udało się zapisać zmian.");
    await logEvent({ type: "voice_submission_update", actor: context.userId, objectKind: "voice_submission", objectId: data.id, detail: `status: ${data.status}` });
    return { ok: true as const };
  });

// ---------- Instagram (official OAuth, see instagram.server.ts) ----------
export type PublicReel = { id: string; media_type: string; product_type: string | null; thumbnail_url: string | null; permalink: string; caption: string | null; posted_at: string };

/** Public: newest synced media + profile link. Empty when not connected — never placeholders. */
export const listInstagram = createServerFn({ method: "GET" }).handler(async () => {
  const ig = await import("./instagram.server");
  await ig.syncIfStale();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: s } = await supabaseAdmin.from("instagram_source").select("status, username, profile_url, display_count").eq("id", 1).maybeSingle();
  const connected = !!s && s.status !== "disconnected" && !!s.username;
  if (!connected) return { connected: false, username: null, profileUrl: null, items: [] as PublicReel[] };
  const db = await anonDb();
  const { data } = await db.from("instagram_media").select("id, media_type, product_type, thumbnail_url, permalink, caption, posted_at")
    .not("thumbnail_url", "is", null).order("posted_at", { ascending: false }).limit(s.display_count);
  return { connected, username: s.username, profileUrl: s.profile_url, items: (data ?? []) as PublicReel[] };
});

export const adminGetInstagram = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("instagram_source").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error("Nie udało się pobrać ustawień Instagrama.");
    const ig = await import("./instagram.server");
    const prod = ig.productionOrigin();
    return { ...data, appConfigured: ig.appConfigured(), callbackPath: ig.CALLBACK_PATH, productionCallback: prod ? prod + ig.CALLBACK_PATH : null };
  });

export const adminCheckInstagramConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const ig = await import("./instagram.server");
    const r = await ig.checkConfig();
    await logEvent({ type: "instagram_config_check", actor: context.userId, objectKind: "instagram_source", result: r.ok ? "ok" : "failed", detail: r.checks.filter((c) => !c.ok).map((c) => c.key).join(",") || "komplet" });
    return r;
  });

export const adminStartInstagramConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ origin: z.string().url().max(200).refine((o) => /^https:\/\//.test(o) || /^http:\/\/localhost(:\d+)?$/.test(o), "Nieprawidłowy adres") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const ig = await import("./instagram.server");
    const url = await ig.startOAuth(new URL(data.origin).origin, context.userId);
    await logEvent({ type: "instagram_connect_start", actor: context.userId, objectKind: "instagram_source" });
    return { url };
  });

export const adminSyncInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const ig = await import("./instagram.server");
    try { const r = await ig.sync(); await logEvent({ type: "instagram_sync", actor: context.userId, detail: `nowe ${r.added}, razem ${r.total}` }); return r; }
    catch (e) { const m = e instanceof Error ? e.message : "Błąd synchronizacji"; await logEvent({ type: "instagram_sync", actor: context.userId, result: "failed", detail: m }); throw new Error(m); }
  });

export const adminDisconnectInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const ig = await import("./instagram.server");
    await ig.disconnect();
    await logEvent({ type: "instagram_disconnect", actor: context.userId, objectKind: "instagram_source" });
    return { ok: true };
  });

export const adminSaveInstagramOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ show_reels: z.boolean(), show_posts: z.boolean(), show_carousels: z.boolean(), display_count: z.number().int().min(1).max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("instagram_source").update({ ...data, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw new Error("Nie udało się zapisać ustawień.");
    await logEvent({ type: "instagram_options", actor: context.userId, objectKind: "instagram_source", detail: JSON.stringify(data) });
    return { ok: true };
  });
