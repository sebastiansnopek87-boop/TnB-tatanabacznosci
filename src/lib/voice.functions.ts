// Głos TNB: extension of the Podcast module — manual YouTube links and guest
// story submissions. Episodes stay in podcast.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logEvent } from "./admin-auth.server";
import { SUBMISSION_STATUSES, youtubeId } from "./voice";

export type PublicVideo = { id: string; youtube_id: string; title: string; description: string; published_on: string | null; thumbnail_url: string | null };

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
  const db = await anonDb();
  const { data, error } = await db.from("podcast_videos")
    .select("id, youtube_id, title, description, published_on, thumbnail_url")
    .eq("status", "published").order("sort_order").order("published_on", { ascending: false, nullsFirst: false });
  if (error) throw new Error("Nie udało się pobrać materiałów wideo.");
  return (data ?? []) as PublicVideo[];
});

// ---------- admin: videos ----------
export const adminListVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("podcast_videos").select("*").order("sort_order").order("created_at", { ascending: false });
    if (error) throw new Error("Nie udało się pobrać materiałów wideo.");
    return data as Array<PublicVideo & { status: "draft" | "published" | "hidden"; sort_order: number; created_at: string }>;
  });

const videoSchema = z.object({
  id: z.string().uuid().nullable(),
  url: z.string().trim().min(1, "Wklej adres filmu YouTube").max(500),
  title: z.string().trim().min(1, "Podaj tytuł").max(200),
  description: z.string().trim().max(1000),
  published_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  thumbnail_url: z.union([z.string().trim().url().max(500).refine((v) => v.startsWith("https://"), "Miniatura musi mieć adres https://"), z.literal("")]),
  sort_order: z.number().int().min(-1000).max(1000),
});

export const adminSaveVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => videoSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const yt = youtubeId(data.url);
    if (!yt) throw new Error("To nie jest poprawny adres filmu YouTube.");
    const row = { youtube_id: yt, title: data.title, description: data.description, published_on: data.published_on,
      thumbnail_url: data.thumbnail_url || null, sort_order: data.sort_order, updated_at: new Date().toISOString() };
    const q = data.id
      ? context.supabase.from("podcast_videos").update(row).eq("id", data.id).select("id").single()
      : context.supabase.from("podcast_videos").insert(row).select("id").single();
    const { data: r, error } = await q;
    if (error || !r) throw new Error("Nie udało się zapisać materiału.");
    await logEvent({ type: data.id ? "voice_video_update" : "voice_video_create", actor: context.userId, objectKind: "podcast_video", objectId: r.id });
    return { id: r.id as string };
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

export const adminDeleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("podcast_videos").delete().eq("id", data.id);
    if (error) throw new Error("Nie udało się usunąć materiału.");
    await logEvent({ type: "voice_video_delete", actor: context.userId, objectKind: "podcast_video", objectId: data.id });
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
