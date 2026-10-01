import { assertAdmin, logEvent } from "./admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSafeHref, normalizeSections } from "./pages";
import { readingMinutes } from "./articles";

// Editorial articles. Writes: requireSupabaseAuth + assertAdmin + admin-only RLS on articles (defense in depth).
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const BUCKET = "article-images";
const SLUG = z.string().regex(/^[a-z0-9-]{1,120}$/, "Adres może zawierać tylko małe litery, cyfry i myślniki.");
const IMG = z.string().regex(/^[a-z0-9-]+\.(jpg|png|webp)$/);

export const adminListArticles = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const { data, error } = await context.supabase.from("articles")
    .select("id, slug, title, category, status, published_at, featured, home_order, updated_at").order("updated_at", { ascending: false });
  if (error) throw new Error("Nie udało się pobrać artykułów.");
  const { data: st } = await context.supabase.from("article_settings").select("home_mode").eq("id", 1).maybeSingle();
  return { items: data as any[], homeMode: (st?.home_mode ?? "latest") as "latest" | "featured" };
});

export const adminGetArticle = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: a, error } = await context.supabase.from("articles").select("*").eq("id", data.id).maybeSingle();
    if (error || !a) throw new Error("Nie znaleziono artykułu.");
    return a as any;
  });

export const adminCheckArticleSlug = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(120), id: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!/^[a-z0-9-]{1,120}$/.test(data.slug)) return { ok: false, reason: "Tylko małe litery, cyfry i myślniki." };
    const { data: r } = await context.supabase.from("articles").select("id").eq("slug", data.slug).maybeSingle();
    return r && r.id !== data.id ? { ok: false, reason: "Ten adres jest już zajęty." } : { ok: true, reason: "" };
  });

const Btn = z.object({ label: z.string().trim().min(1, "Przycisk musi mieć etykietę.").max(60), href: z.string().trim().max(500).refine(isSafeHref, "Adres przycisku musi zaczynać się od / lub https://") });
const Section = z.object({
  id: z.string().regex(/^[a-z0-9]{1,20}$/), kind: z.enum(["hero", "text", "values", "columns", "quote", "image", "cta"]),
  eyebrow: z.string().max(200).default(""), layout: z.enum(["left", "right"]).default("right"), display: z.enum(["full", "inset", "featured"]).default("full"), decorative: z.boolean().default(false),
  items: z.array(z.object({ title: z.string().max(120), body: z.string().max(3000) })).max(12).default([]),
  heading: z.string().max(200), body: z.string().max(30000), image: IMG.nullable(),
  imageAlt: z.string().max(200), caption: z.string().max(300), quoteAuthor: z.string().max(120), buttons: z.array(Btn).max(4),
});
const ArticleInput = z.object({
  id: z.string().uuid().nullable(), slug: SLUG,
  title: z.string().trim().min(2, "Tytuł musi mieć co najmniej 2 znaki.").max(200),
  excerpt: z.string().trim().max(600, "Zajawka: maks. 600 znaków."),
  category: z.string().max(60).nullable(),
  author_name: z.string().trim().min(2, "Podaj autora.").max(120),
  cover: IMG.nullable(), cover_alt: z.string().max(200),
  sections: z.array(Section).max(80),
  published_at: z.string().datetime({ offset: true }).nullable(),
  featured: z.boolean(), home_order: z.number().int().min(0).max(999),
  seo_title: z.string().max(70, "Tytuł SEO: maks. 70 znaków."), seo_description: z.string().max(170, "Opis SEO: maks. 170 znaków."),
  reflection_question: z.string().trim().max(400, "Pytanie do refleksji: maks. 400 znaków.").default(""),
  discussion_question: z.string().trim().max(400, "Pytanie do dyskusji: maks. 400 znaków.").default(""),
});

export const adminSaveArticle = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ArticleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...row } = data;
    const full = { ...row, category: row.category || null, reading_minutes: readingMinutes(row.excerpt, normalizeSections(row.sections)) };
    const q = id
      ? context.supabase.from("articles").update(full).eq("id", id).select("id").single()
      : context.supabase.from("articles").insert({ ...full, created_by: context.userId }).select("id").single();
    const { data: r, error } = await q;
    if (error) throw new Error(error.code === "23505" ? "Artykuł o takim adresie już istnieje." : "Nie udało się zapisać artykułu.");
    await logEvent({ type: id ? "article_edit" : "article_create", actor: context.userId, objectKind: "article", objectId: r.id, detail: row.slug });
    return { id: r.id as string };
  });

export const adminSetArticleStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // published_at stays as set by the editor (a future date = scheduled); the touch trigger fills it when empty.
    const { data: r, error } = await context.supabase.from("articles").update({ status: data.status }).eq("id", data.id).select("published_at").single();
    await logEvent({ type: `article_${data.status}`, actor: context.userId, objectKind: "article", objectId: data.id, result: error ? "failed" : "ok" });
    if (error) throw new Error("Nie udało się zmienić statusu.");
    return { published_at: r.published_at as string | null };
  });

export const adminSetFeatured = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), featured: z.boolean(), home_order: z.number().int().min(0).max(999) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("articles").update({ featured: data.featured, home_order: data.home_order }).eq("id", data.id);
    if (error) throw new Error("Nie udało się zapisać wyróżnienia.");
    await logEvent({ type: "article_edit", actor: context.userId, objectKind: "article", objectId: data.id, detail: data.featured ? `wyróżniony (${data.home_order})` : "bez wyróżnienia" });
    return { ok: true };
  });

export const adminSetHomeMode = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mode: z.enum(["latest", "featured"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("article_settings").upsert({ id: 1, home_mode: data.mode, updated_at: new Date().toISOString() });
    if (error) throw new Error("Nie udało się zapisać ustawienia.");
    await logEvent({ type: "article_home_mode", actor: context.userId, objectKind: "article", detail: data.mode });
    return { ok: true };
  });

export const adminSaveCategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    original: z.string().max(60).nullable(),
    slug: z.string().regex(/^[a-z0-9-]{1,60}$/, "Adres kategorii: małe litery, cyfry i myślniki."),
    name: z.string().trim().min(2, "Nazwa kategorii: min. 2 znaki.").max(80), sort_order: z.number().int().min(0).max(999),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = { slug: data.slug, name: data.name, sort_order: data.sort_order };
    const { error } = data.original
      ? await context.supabase.from("article_categories").update(row).eq("slug", data.original)
      : await context.supabase.from("article_categories").insert(row);
    if (error) throw new Error(error.code === "23505" ? "Kategoria o takim adresie już istnieje." : "Nie udało się zapisać kategorii.");
    await logEvent({ type: "article_category_save", actor: context.userId, objectKind: "article", detail: data.slug });
    return { ok: true };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { count } = await context.supabase.from("articles").select("id", { count: "exact", head: true }).eq("category", data.slug);
    if (count) throw new Error(`Kategorii używa ${count} artykuł(ów). Najpierw zmień im kategorię.`);
    const { error } = await context.supabase.from("article_categories").delete().eq("slug", data.slug);
    if (error) throw new Error("Nie udało się usunąć kategorii.");
    await logEvent({ type: "article_category_delete", actor: context.userId, objectKind: "article", detail: data.slug });
    return { ok: true };
  });

const IMAGES = ["image/jpeg", "image/png", "image/webp"];
export const adminCreateArticleUpload = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), type: z.string().max(100), size: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!IMAGES.includes(data.type)) throw new Error("Zdjęcie musi być plikiem JPG, PNG lub WEBP.");
    if (data.size > 8 * 1024 * 1024) throw new Error("Zdjęcie może mieć maksymalnie 8 MB.");
    const name = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${(data.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg")}`;
    const { data: s, error } = await (await admin()).storage.from(BUCKET).createSignedUploadUrl(`${data.id}/${name}`);
    if (error || !s) throw new Error("Nie udało się przygotować przesyłania.");
    return { path: s.path, token: s.token, name };
  });

export const adminArticleImageUrls = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), names: z.array(IMG).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.names.length) return {} as Record<string, string>;
    const { data: s } = await (await admin()).storage.from(BUCKET).createSignedUrls(data.names.map((n) => `${data.id}/${n}`), 3600);
    const out: Record<string, string> = {};
    (s ?? []).forEach((x, i) => { if (x.signedUrl) out[data.names[i]!] = x.signedUrl; });
    return out;
  });

// ---- Reader interactions (0032): polls, aggregate stats, comment moderation ----
export const adminArticleInteractions = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const [{ data: poll }, { data: st }] = await Promise.all([
      context.supabase.from("article_polls").select("question, options, active").eq("article_id", data.id).maybeSingle(),
      context.supabase.rpc("article_stats", { _article: data.id }),
    ]);
    const stats = { reactions: {} as Record<string, number>, poll: {} as Record<string, number>, comments: 0 };
    for (const r of (st ?? []) as any[]) { if (r.kind === "reaction") stats.reactions[r.key] = Number(r.n); else if (r.kind === "poll") stats.poll[r.key] = Number(r.n); else stats.comments = Number(r.n); }
    return { poll: poll ? { question: poll.question as string, options: poll.options as string[], active: poll.active as boolean } : null, stats };
  });

export const adminSavePoll = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    question: z.string().trim().min(3, "Pytanie ankiety: min. 3 znaki.").max(200),
    options: z.array(z.string().trim().min(1, "Odpowiedź nie może być pusta.").max(120)).min(2, "Ankieta potrzebuje co najmniej 2 odpowiedzi.").max(6, "Maks. 6 odpowiedzi."),
    active: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: old } = await context.supabase.from("article_polls").select("options").eq("article_id", data.id).maybeSingle();
    if (old) {
      const { count } = await context.supabase.from("article_poll_votes").select("user_id", { count: "exact", head: true }).eq("article_id", data.id);
      if (count && JSON.stringify(old.options) !== JSON.stringify(data.options))
        throw new Error("Ankieta ma już głosy — odpowiedzi nie można zmienić, bo wyniki straciłyby sens. Możesz zmienić pytanie lub zamknąć głosowanie.");
    }
    const { error } = await context.supabase.from("article_polls").upsert({ article_id: data.id, question: data.question, options: data.options, active: data.active, updated_at: new Date().toISOString() });
    if (error) throw new Error("Nie udało się zapisać ankiety.");
    await logEvent({ type: "article_poll_save", actor: context.userId, objectKind: "article", objectId: data.id, detail: data.question });
    return { ok: true };
  });

export const adminDeletePoll = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("article_polls").delete().eq("article_id", data.id);
    if (error) throw new Error("Nie udało się usunąć ankiety.");
    await logEvent({ type: "article_poll_delete", actor: context.userId, objectKind: "article", objectId: data.id });
    return { ok: true };
  });

export const adminListArticleComments = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ filter: z.enum(["all", "reported", "hidden"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase.from("article_comments")
      .select("id, article_id, author_name, body, status, created_at, updated_at, articles(title, slug), article_comment_reports(id, reason, status)")
      .order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error("Nie udało się pobrać komentarzy.");
    const items = (rows ?? []).map((r: any) => ({
      id: r.id as string, author_name: r.author_name as string, body: r.body as string, status: r.status as string, created_at: r.created_at as string,
      article: r.articles as { title: string; slug: string } | null,
      reports: ((r.article_comment_reports ?? []) as any[]).filter((x) => x.status === "open").map((x) => x.reason as string),
    }));
    return items.filter((c) => data.filter === "all" || (data.filter === "reported" ? c.reports.length > 0 : c.status === "hidden"));
  });

export const adminModerateArticleComment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), action: z.enum(["hide", "show", "delete", "dismiss"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { error } = data.action === "delete" ? await sb.from("article_comments").delete().eq("id", data.id)
      : data.action === "dismiss" ? { error: null }
      : await sb.from("article_comments").update({ status: data.action === "hide" ? "hidden" : "visible" }).eq("id", data.id);
    if (error) throw new Error("Nie udało się wykonać operacji.");
    if (data.action !== "delete") await sb.from("article_comment_reports").update({ status: "resolved" }).eq("comment_id", data.id).eq("status", "open");
    await logEvent({ type: `article_comment_${data.action}`, actor: context.userId, objectKind: "article_comment", objectId: data.id });
    return { ok: true };
  });
