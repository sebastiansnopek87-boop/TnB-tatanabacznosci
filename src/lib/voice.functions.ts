// Głos TNB: guest stories and Instagram integration. YouTube uses the dedicated tnb-youtube Edge Function adapter.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logEvent } from "./admin-auth.server";
import { SUBMISSION_STATUSES } from "./voice";

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
