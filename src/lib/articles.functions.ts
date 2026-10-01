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
  eyebrow: z.string().max(200).default(""), layout: z.enum(["left", "right"]).default("right"),
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
