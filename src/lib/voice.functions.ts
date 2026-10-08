// Głos TNB: extension of the Podcast module — YouTube channel sync (youtube.server.ts) and guest
// story submissions. Episodes stay in podcast.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logEvent } from "./admin-auth.server";
import { SUBMISSION_STATUSES } from "./voice";

export type PublicVideo = { id: string; youtube_id: string; title: string; description: string; published_on: string | null; published_at: string | null; thumbnail_url: string | null; duration_seconds: number | null };

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

export const listVideos = createServerFn({ method: "GET" }).handler(async () => {
  const { syncIfStale } = await import("./youtube.server");
  await syncIfStale();
  const db = await anonDb();
  const { data, error } = await db.from("podcast_videos")
    .select("id, youtube_id, title, description, published_on, published_at, thumbnail_url, duration_seconds")
    .eq("status", "published").order("published_at", { ascending: false, nullsFirst: false }).order("published_on", { ascending: false, nullsFirst: false }).limit(200);
  if (error) throw new Error("Nie udało się pobrać materiałów wideo.");
  return (data ?? []) as PublicVideo[];
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

// ---------- admin: videos (visibility only; content comes from YouTube) ----------
export const adminListVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("podcast_videos").select("*").order("published_at", { ascending: false, nullsFirst: false }).limit(300);
    if (error) throw new Error("Nie udało się pobrać materiałów wideo.");
    return data as Array<PublicVideo & { status: "draft" | "published" | "hidden"; source: "manual" | "youtube"; synced_at: string | null }>;
  });

export const adminSetVideoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "hidden"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("podcast_videos").update({ status: data.status, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error("Nie udało się zmienić statusu.");
    await logEvent({ type: "voice_video_status", actor: context.userId, objectKind: "podcast_video", objectId: data.id, detail: data.status });
    return { ok: true as const };
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
    return { ...data, appConfigured: ig.appConfigured(), callbackPath: ig.CALLBACK_PATH };
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
