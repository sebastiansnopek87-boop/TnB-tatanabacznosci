import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TextFormatsSchema } from "./_shared/rich-text.ts";
import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";

type Context = { supabase: any; supabaseAdmin: any; userId: string };
class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
}

const BUCKET = "article-images";
const SLUG = z.string().regex(/^[a-z0-9-]{1,120}$/, "Adres może zawierać tylko małe litery, cyfry i myślniki.");
const IMG = z.string().regex(/^[a-z0-9-]+\.(jpg|png|webp)$/);
const TRASH_DAYS = 30;
const ALLOWED_ORIGINS = new Set([
  "https://tatanabacznosci.pl",
  "https://www.tatanabacznosci.pl",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const isSafeHref = (href: string) =>
  /^\/(?!\/)[\w\-/#?=&.%]*$/.test(href) ||
  /^https:\/\/\S+$/.test(href) ||
  /^mailto:\S+$/.test(href);

const Btn = z.object({
  label: z.string().trim().min(1, "Przycisk musi mieć etykietę.").max(60),
  href: z.string().trim().max(500).refine(isSafeHref, "Adres przycisku musi zaczynać się od / lub https://"),
});
const Section = z.object({
  textFormats: TextFormatsSchema,
  id: z.string().regex(/^[a-z0-9]{1,20}$/),
  kind: z.enum(["hero", "text", "values", "columns", "quote", "image", "cta"]),
  eyebrow: z.string().max(200).default(""),
  layout: z.enum(["left", "right"]).default("right"),
  display: z.enum(["full", "inset", "featured"]).default("full"),
  decorative: z.boolean().default(false),
  items: z.array(z.object({ title: z.string().max(120), body: z.string().max(3000) })).max(12).default([]),
  heading: z.string().max(200),
  body: z.string().max(30000),
  image: IMG.nullable(),
  imageAlt: z.string().max(200),
  caption: z.string().max(300),
  quoteAuthor: z.string().max(120),
  buttons: z.array(Btn).max(4),
});
const ArticleInput = z.object({
  id: z.string().uuid().nullable(),
  slug: SLUG,
  title: z.string().trim().min(2, "Tytuł musi mieć co najmniej 2 znaki.").max(200),
  excerpt: z.string().trim().max(600, "Zajawka: maks. 600 znaków."),
  category: z.string().max(60).nullable(),
  author_name: z.string().trim().min(2, "Podaj autora.").max(120),
  cover: IMG.nullable(),
  cover_alt: z.string().max(200),
  sections: z.array(Section).max(80),
  published_at: z.string().datetime({ offset: true }).nullable(),
  featured: z.boolean(),
  home_order: z.number().int().min(0).max(999),
  seo_title: z.string().max(70, "Tytuł SEO: maks. 70 znaków."),
  seo_description: z.string().max(170, "Opis SEO: maks. 170 znaków."),
  reflection_question: z.string().trim().max(400, "Pytanie do refleksji: maks. 400 znaków.").default(""),
  discussion_question: z.string().trim().max(400, "Pytanie do dyskusji: maks. 400 znaków.").default(""),
});
const SavePollInput = z.object({
  id: z.string().uuid(),
  question: z.string().trim().min(3, "Pytanie ankiety: min. 3 znaki.").max(200),
  options: z.array(z.string().trim().min(1, "Odpowiedź nie może być pusta.").max(120))
    .min(2, "Ankieta potrzebuje co najmniej 2 odpowiedzi.")
    .max(6, "Maks. 6 odpowiedzi."),
  active: z.boolean(),
});
const CategoryInput = z.object({
  original: z.string().max(60).nullable(),
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/, "Adres kategorii: małe litery, cyfry i myślniki."),
  name: z.string().trim().min(2, "Nazwa kategorii: min. 2 znaki.").max(80),
  sort_order: z.number().int().min(0).max(999),
});
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("adminListArticles") }),
  z.object({ action: z.literal("adminTrashArticle"), data: z.object({ id: z.string().uuid(), action: z.enum(["trash", "restore", "purge"]) }) }),
  z.object({ action: z.literal("adminGetArticle"), data: z.object({ id: z.string().uuid() }) }),
  z.object({ action: z.literal("adminCheckArticleSlug"), data: z.object({ slug: z.string().max(120), id: z.string().uuid().nullable() }) }),
  z.object({ action: z.literal("adminSaveArticle"), data: ArticleInput }),
  z.object({ action: z.literal("adminSetArticleStatus"), data: z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }) }),
  z.object({ action: z.literal("adminSetFeatured"), data: z.object({ id: z.string().uuid(), featured: z.boolean(), home_order: z.number().int().min(0).max(999) }) }),
  z.object({ action: z.literal("adminSetHomeMode"), data: z.object({ mode: z.enum(["latest", "featured"]) }) }),
  z.object({ action: z.literal("adminSaveCategory"), data: CategoryInput }),
  z.object({ action: z.literal("adminDeleteCategory"), data: z.object({ slug: z.string().max(60) }) }),
  z.object({ action: z.literal("adminCreateArticleUpload"), data: z.object({ id: z.string().uuid(), type: z.string().max(100), size: z.number().int().positive() }) }),
  z.object({ action: z.literal("adminArticleImageUrls"), data: z.object({ id: z.string().uuid(), names: z.array(IMG).max(80) }) }),
  z.object({ action: z.literal("adminArticleInteractions"), data: z.object({ id: z.string().uuid() }) }),
  z.object({ action: z.literal("adminSavePoll"), data: SavePollInput }),
  z.object({ action: z.literal("adminDeletePoll"), data: z.object({ id: z.string().uuid() }) }),
  z.object({ action: z.literal("adminListArticleComments"), data: z.object({ filter: z.enum(["all", "reported", "hidden", "pending"]) }) }),
  z.object({ action: z.literal("adminModerateArticleComment"), data: z.object({ id: z.string().uuid(), action: z.enum(["hide", "show", "delete", "dismiss", "reject"]) }) }),
]);

function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const value = JSON.parse(raw);
      if (typeof value === "string") return value;
      if (value && typeof value.default === "string") return value.default;
    } catch { return raw; }
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
function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secret = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) throw new ApiError("Usługa jest chwilowo niedostępna.", 503, "backend_not_configured");
  return createClient(url, secret, {
    global: { fetch: createSupabaseFetch(secret) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
async function createContext(req: Request): Promise<Context> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new ApiError("Wymagane jest zalogowanie.", 401, "unauthorized");
  const token = auth.slice(7).trim();
  if (!token) throw new ApiError("Wymagane jest zalogowanie.", 401, "unauthorized");
  const url = Deno.env.get("SUPABASE_URL");
  const publishable = envKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
  if (!url || !publishable) throw new ApiError("Usługa jest chwilowo niedostępna.", 503, "backend_not_configured");
  const supabase = createClient(url, publishable, {
    global: { fetch: createSupabaseFetch(publishable), headers: { Authorization: "Bearer " + token } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  const userId = data?.user?.id;
  if (error || typeof userId !== "string" || !userId) throw new ApiError("Sesja jest nieprawidłowa lub wygasła.", 401, "unauthorized");
  return { supabase, supabaseAdmin: createAdminClient(), userId };
}
async function logEvent(ctx: Context, event: {
  type: string; objectKind?: string; objectId?: string; result?: "ok" | "failed" | "denied"; detail?: string;
}): Promise<void> {
  try {
    const { error } = await ctx.supabaseAdmin.from("admin_events").insert({
      type: event.type, actor: ctx.userId, object_kind: event.objectKind ?? null,
      object_id: event.objectId ?? null, result: event.result ?? "ok", detail: event.detail?.slice(0, 300) ?? null,
    });
    if (error) console.error("TNB articles audit event failed");
  } catch { console.error("TNB articles audit event failed"); }
}
async function requireAdmin(ctx: Context): Promise<void> {
  const { data, error } = await ctx.supabaseAdmin.from("user_roles").select("role").eq("user_id", ctx.userId);
  if (error || !(data ?? []).some((row: { role: string }) => row.role === "admin")) {
    await logEvent(ctx, { type: "access_denied", objectKind: "article", result: "denied", detail: "Wymagana rola administratora" });
    throw new ApiError("Brak uprawnień administratora.", 403, "forbidden");
  }
}
function corsHeaders(origin: string | null, publicRead = false): Headers {
  const headers = new Headers(supabaseCorsHeaders);
  headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  headers.delete("Access-Control-Allow-Origin");
  if (publicRead) headers.set("Access-Control-Allow-Origin", "*");
  else if (origin && ALLOWED_ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}
function addHeaders(response: Response, headers: Headers): Response {
  const merged = new Headers(response.headers);
  headers.forEach((value, key) => merged.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}
function readingMinutes(excerpt: string, sections: any[]): number {
  const text = [excerpt, ...sections.flatMap((s) => [s.heading, s.body, s.caption, ...s.items.flatMap((i: any) => [i.title, i.body])])].join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
async function purgeArticle(sb: any, id: string) {
  for (const table of ["article_ai_origin", "article_newsletters", "article_reactions", "article_saves", "article_poll_votes", "article_polls"]) {
    await sb.from(table).delete().eq("article_id", id);
  }
  const { data: comments } = await sb.from("article_comments").select("id").eq("article_id", id);
  const ids = (comments ?? []).map((comment: any) => comment.id);
  if (ids.length) {
    await sb.from("article_comment_reports").delete().in("comment_id", ids);
    await sb.from("article_comment_guests").delete().in("comment_id", ids);
    await sb.from("article_comments").delete().in("id", ids);
  }
  await sb.from("ai_materials").update({ handoff_id: null }).eq("handoff_id", id);
  return sb.from("articles").delete().eq("id", id);
}

async function adminListArticles(ctx: Context) {
  await requireAdmin(ctx);
  const cutoff = new Date(Date.now() - TRASH_DAYS * 864e5).toISOString();
  const { data: old, error: trashError } = await ctx.supabaseAdmin.from("articles").select("id").lt("deleted_at", cutoff);
  if (!trashError) {
    for (const item of old ?? []) {
      const { error } = await purgeArticle(ctx.supabaseAdmin, item.id);
      await logEvent(ctx, { type: "article_purged_auto", objectKind: "article", objectId: item.id, result: error ? "failed" : "ok" });
    }
  }
  const { data, error } = await ctx.supabase.from("articles")
    .select("id, slug, title, category, status, published_at, featured, home_order, updated_at, deleted_at")
    .order("updated_at", { ascending: false });
  if (error) throw new ApiError("Nie udało się pobrać artykułów.", 500, "articles_list_failed");
  const { data: settings } = await ctx.supabase.from("article_settings").select("home_mode").eq("id", 1).maybeSingle();
  return { items: data ?? [], homeMode: settings?.home_mode ?? "latest" };
}
async function adminTrashArticle(ctx: Context, input: any) {
  await requireAdmin(ctx);
  const { data: article } = await ctx.supabase.from("articles").select("status, deleted_at, deleted_prev_status").eq("id", input.id).maybeSingle();
  if (!article) throw new ApiError("Nie znaleziono artykułu.", 404, "article_not_found");
  let error: any = null;
  if (input.action === "trash") {
    if (article.deleted_at) throw new ApiError("Artykuł jest już w koszu.", 409, "article_already_trashed");
    ({ error } = await ctx.supabase.from("articles").update({
      deleted_at: new Date().toISOString(), deleted_prev_status: article.status, status: "archived", featured: false,
    }).eq("id", input.id));
  } else if (input.action === "restore") {
    ({ error } = await ctx.supabase.from("articles").update({
      deleted_at: null, deleted_prev_status: null,
      status: article.deleted_prev_status === "published" ? "draft" : (article.deleted_prev_status ?? "draft"),
    }).eq("id", input.id));
  } else {
    if (!article.deleted_at) throw new ApiError("Na stałe można usunąć tylko artykuł z kosza.", 409, "article_not_trashed");
    ({ error } = await purgeArticle(ctx.supabaseAdmin, input.id));
  }
  await logEvent(ctx, { type: "article_" + input.action, objectKind: "article", objectId: input.id, result: error ? "failed" : "ok", detail: error?.message });
  if (error) throw new ApiError("Nie udało się wykonać operacji.", 500, "article_trash_failed");
  return { ok: true as const };
}
async function adminGetArticle(ctx: Context, id: string) {
  await requireAdmin(ctx);
  const { data, error } = await ctx.supabase.from("articles").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new ApiError("Nie znaleziono artykułu.", 404, "article_not_found");
  return data;
}
async function adminCheckArticleSlug(ctx: Context, input: any) {
  await requireAdmin(ctx);
  if (!/^[a-z0-9-]{1,120}$/.test(input.slug)) return { ok: false, reason: "Tylko małe litery, cyfry i myślniki." };
  const { data, error } = await ctx.supabase.from("articles").select("id").eq("slug", input.slug).maybeSingle();
  if (error) throw new ApiError("Nie udało się sprawdzić adresu artykułu.", 500, "article_slug_check_failed");
  return data && data.id !== input.id ? { ok: false, reason: "Ten adres jest już zajęty." } : { ok: true, reason: "" };
}
async function adminSaveArticle(ctx: Context, input: any) {
  await requireAdmin(ctx);
  const { id, ...row } = input;
  const full = { ...row, category: row.category || null, reading_minutes: readingMinutes(row.excerpt, row.sections) };
  const query = id
    ? ctx.supabase.from("articles").update(full).eq("id", id).select("id").single()
    : ctx.supabase.from("articles").insert({ ...full, created_by: ctx.userId }).select("id").single();
  const { data, error } = await query;
  if (error) throw new ApiError(error.code === "23505" ? "Artykuł o takim adresie już istnieje." : "Nie udało się zapisać artykułu.", 400, "article_save_failed");
  await logEvent(ctx, { type: id ? "article_edit" : "article_create", objectKind: "article", objectId: data.id, detail: row.slug });
  return { id: data.id as string };
}
async function adminSetArticleStatus(ctx: Context, input: any) {
  await requireAdmin(ctx);
  const { data, error } = await ctx.supabase.from("articles").update({ status: input.status }).eq("id", input.id).select("published_at").single();
  await logEvent(ctx, { type: "article_" + input.status, objectKind: "article", objectId: input.id, result: error ? "failed" : "ok" });
  if (error) throw new ApiError("Nie udało się zmienić statusu.", 500, "article_status_failed");
  return { published_at: data.published_at as string | null };
}
async function adminSetFeatured(ctx: Context, input: any) {
  await requireAdmin(ctx);
  const { error } = await ctx.supabase.from("articles").update({ featured: input.featured, home_order: input.home_order }).eq("id", input.id);
  if (error) throw new ApiError("Nie udało się zapisać wyróżnienia.", 500, "article_featured_failed");
  await logEvent(ctx, { type: "article_edit", objectKind: "article", objectId: input.id, detail: input.featured ? "wyróżniony (" + input.home_order + ")" : "bez wyróżnienia" });
  return { ok: true as const };
}
async function adminSetHomeMode(ctx: Context, input: any) {
  await requireAdmin(ctx);
  const { error } = await ctx.supabase.from("article_settings").upsert({ id: 1, home_mode: input.mode, updated_at: new Date().toISOString() });
  if (error) throw new ApiError("Nie udało się zapisać ustawienia.", 500, "article_home_mode_failed");
  await logEvent(ctx, { type: "article_home_mode", objectKind: "article", detail: input.mode });
  return { ok: true as const };
}
async function adminSaveCategory(ctx: Context, input: any) {
  await requireAdmin(ctx);
  const row = { slug: input.slug, name: input.name, sort_order: input.sort_order };
  const { error } = input.original
    ? await ctx.supabase.from("article_categories").update(row).eq("slug", input.original)
    : await ctx.supabase.from("article_categories").insert(row);
  if (error) throw new ApiError(error.code === "23505" ? "Kategoria o takim adresie już istnieje." : "Nie udało się zapisać kategorii.", 400, "article_category_save_failed");
  await logEvent(ctx, { type: "article_category_save", objectKind: "article", detail: input.slug });
  return { ok: true as const };
}
async function adminDeleteCategory(ctx: Context, slug: string) {
  await requireAdmin(ctx);
  const { count, error: countError } = await ctx.supabase.from("articles").select("id", { count: "exact", head: true }).eq("category", slug);
  if (countError) throw new ApiError("Nie udało się sprawdzić użycia kategorii.", 500, "article_category_count_failed");
  if (count) throw new ApiError("Kategorii używa " + count + " artykuł(ów). Najpierw zmień im kategorię.", 409, "article_category_in_use");
  const { error } = await ctx.supabase.from("article_categories").delete().eq("slug", slug);
  if (error) throw new ApiError("Nie udało się usunąć kategorii.", 500, "article_category_delete_failed");
  await logEvent(ctx, { type: "article_category_delete", objectKind: "article", detail: slug });
  return { ok: true as const };
}
async function adminCreateArticleUpload(ctx: Context, input: any) {
  await requireAdmin(ctx);
  if (!["image/jpeg", "image/png", "image/webp"].includes(input.type)) throw new ApiError("Zdjęcie musi być plikiem JPG, PNG lub WEBP.", 400, "invalid_image_type");
  if (input.size > 8 * 1024 * 1024) throw new ApiError("Zdjęcie może mieć maksymalnie 8 MB.", 413, "image_too_large");
  const name = "img-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "." + (input.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
  const { data, error } = await ctx.supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(input.id + "/" + name);
  if (error || !data) throw new ApiError("Nie udało się przygotować przesyłania.", 500, "article_upload_failed");
  return { path: data.path, token: data.token, name };
}
async function adminArticleImageUrls(ctx: Context, input: any) {
  await requireAdmin(ctx);
  if (!input.names.length) return {};
  const { data } = await ctx.supabaseAdmin.storage.from(BUCKET).createSignedUrls(input.names.map((name: string) => input.id + "/" + name), 3600);
  const out: Record<string, string> = {};
  (data ?? []).forEach((item: any, index: number) => {
    const name = input.names[index];
    if (item.signedUrl && name) out[name] = item.signedUrl;
  });
  return out;
}
async function adminArticleInteractions(ctx: Context, id: string) {
  await requireAdmin(ctx);
  const [{ data: poll }, { data: rows, error }] = await Promise.all([
    ctx.supabase.from("article_polls").select("question, options, active").eq("article_id", id).maybeSingle(),
    ctx.supabase.rpc("article_stats", { _article: id }),
  ]);
  if (error) throw new ApiError("Nie udało się pobrać statystyk artykułu.", 500, "article_stats_failed");
  const stats = { reactions: {} as Record<string, number>, poll: {} as Record<string, number>, comments: 0 };
  for (const row of (rows ?? []) as any[]) {
    if (row.kind === "reaction") stats.reactions[row.key] = Number(row.n);
    else if (row.kind === "poll") stats.poll[row.key] = Number(row.n);
    else if (row.kind === "comments") stats.comments = Number(row.n);
  }
  return { poll: poll ? { question: poll.question as string, options: poll.options as string[], active: poll.active as boolean } : null, stats };
}
async function adminSavePoll(ctx: Context, input: any) {
  await requireAdmin(ctx);
  const { data: old } = await ctx.supabase.from("article_polls").select("options").eq("article_id", input.id).maybeSingle();
  if (old) {
    const { count, error: countError } = await ctx.supabase.from("article_poll_votes").select("user_id", { count: "exact", head: true }).eq("article_id", input.id);
    if (countError) throw new ApiError("Nie udało się sprawdzić głosów w ankiecie.", 500, "poll_votes_check_failed");
    if (count && JSON.stringify(old.options) !== JSON.stringify(input.options)) {
      throw new ApiError("Ankieta ma już głosy — odpowiedzi nie można zmienić, bo wyniki straciłyby sens. Możesz zmienić pytanie lub zamknąć głosowanie.", 409, "poll_options_locked");
    }
  }
  const { error } = await ctx.supabase.from("article_polls").upsert({
    article_id: input.id, question: input.question, options: input.options, active: input.active, updated_at: new Date().toISOString(),
  });
  if (error) throw new ApiError("Nie udało się zapisać ankiety.", 500, "poll_save_failed");
  await logEvent(ctx, { type: "article_poll_save", objectKind: "article", objectId: input.id, detail: input.question });
  return { ok: true as const };
}
async function adminDeletePoll(ctx: Context, id: string) {
  await requireAdmin(ctx);
  const { error } = await ctx.supabase.from("article_polls").delete().eq("article_id", id);
  if (error) throw new ApiError("Nie udało się usunąć ankiety.", 500, "poll_delete_failed");
  await logEvent(ctx, { type: "article_poll_delete", objectKind: "article", objectId: id });
  return { ok: true as const };
}
async function adminListArticleComments(ctx: Context, filter: string) {
  await requireAdmin(ctx);
  const { data, error } = await ctx.supabase.from("article_comments")
    .select("id, article_id, author_name, body, status, created_at, updated_at, articles(title, slug), article_comment_reports(id, reason, status), article_comment_guests(comment_id)")
    .order("created_at", { ascending: false }).limit(300);
  if (error) throw new ApiError("Nie udało się pobrać komentarzy.", 500, "article_comments_list_failed");
  const items = (data ?? []).map((row: any) => ({
    id: row.id as string, author_name: row.author_name as string, body: row.body as string,
    status: row.status as string, created_at: row.created_at as string,
    article: row.articles as { title: string; slug: string } | null, guest: !!row.article_comment_guests,
    reports: ((row.article_comment_reports ?? []) as any[]).filter((report) => report.status === "open").map((report) => report.reason as string),
  }));
  return items.filter((comment: any) =>
    filter === "all" ||
    (filter === "reported" ? comment.reports.length > 0 :
      filter === "pending" ? ["pending_email", "expired", "confirmed"].includes(comment.status) :
        comment.status === "hidden")
  );
}
async function adminModerateArticleComment(ctx: Context, input: any) {
  await requireAdmin(ctx);
  const update = (status: string, from: string[]) => ctx.supabase.from("article_comments").update({ status }).eq("id", input.id).in("status", from);
  const { error } = input.action === "dismiss" ? { error: null }
    : input.action === "delete" ? await update("deleted", ["pending_email", "confirmed", "visible", "hidden", "rejected", "expired"])
    : input.action === "hide" ? await update("hidden", ["visible", "confirmed"])
    : input.action === "reject" ? await update("rejected", ["pending_email", "expired", "confirmed"])
    : await update("visible", ["hidden"]);
  if (error) throw new ApiError("Nie udało się wykonać operacji.", 500, "article_comment_moderation_failed");
  if (input.action !== "reject") {
    await ctx.supabase.from("article_comment_reports").update({ status: "resolved" }).eq("comment_id", input.id).eq("status", "open");
  }
  await logEvent(ctx, { type: "article_comment_" + input.action, objectKind: "article_comment", objectId: input.id });
  return { ok: true as const };
}

async function servePublicImage(pageId: string, name: string): Promise<Response> {
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageId);
  if (!validId || !IMG.safeParse(name).success) return new Response("Not found", { status: 404 });
  const db = createAdminClient();
  const { data: article, error } = await db.from("articles").select("status, published_at, cover, sections").eq("id", pageId).maybeSingle();
  const live = article && article.status === "published" && article.published_at && new Date(article.published_at) <= new Date();
  const used = article && (article.cover === name || (Array.isArray(article.sections) && (article.sections as any[]).some((section) => section?.image === name)));
  if (error || !live || !used) return new Response("Not found", { status: 404 });
  const { data: blob, error: downloadError } = await db.storage.from(BUCKET).download(pageId + "/" + name);
  if (downloadError || !blob) return new Response("Not found", { status: 404 });
  const contentType = name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": blob.type || contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });

  if (req.method === "GET") {
    const image = url.searchParams.get("image");
    if (!image) return addHeaders(new Response("Not found", { status: 404 }), corsHeaders(origin, true));
    const [id, ...nameParts] = image.split("/");
    const response = await servePublicImage(id ?? "", nameParts.join("/")).catch(() => new Response("Not found", { status: 404 }));
    return addHeaders(response, corsHeaders(origin, true));
  }

  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed", message: "Niedozwolona metoda." }, { status: 405, headers: corsHeaders(origin) });
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return Response.json({ error: "origin_not_allowed", message: "Niedozwolone źródło żądania." }, { status: 403, headers: corsHeaders(origin) });
  }
  const body = await req.text().catch(() => "");
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return Response.json({ error: "payload_too_large", message: "Treść żądania jest zbyt duża." }, { status: 413, headers: corsHeaders(origin) });
  }
  let raw: unknown;
  try { raw = JSON.parse(body); }
  catch { return Response.json({ error: "invalid_json", message: "Nieprawidłowe dane żądania." }, { status: 400, headers: corsHeaders(origin) }); }

  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "validation_error", message: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400, headers: corsHeaders(origin) });
  }

  try {
    const ctx = await createContext(req);
    const input: any = parsed.data;
    let result: unknown;
    switch (input.action) {
      case "adminListArticles": result = await adminListArticles(ctx); break;
      case "adminTrashArticle": result = await adminTrashArticle(ctx, input.data); break;
      case "adminGetArticle": result = await adminGetArticle(ctx, input.data.id); break;
      case "adminCheckArticleSlug": result = await adminCheckArticleSlug(ctx, input.data); break;
      case "adminSaveArticle": result = await adminSaveArticle(ctx, input.data); break;
      case "adminSetArticleStatus": result = await adminSetArticleStatus(ctx, input.data); break;
      case "adminSetFeatured": result = await adminSetFeatured(ctx, input.data); break;
      case "adminSetHomeMode": result = await adminSetHomeMode(ctx, input.data); break;
      case "adminSaveCategory": result = await adminSaveCategory(ctx, input.data); break;
      case "adminDeleteCategory": result = await adminDeleteCategory(ctx, input.data.slug); break;
      case "adminCreateArticleUpload": result = await adminCreateArticleUpload(ctx, input.data); break;
      case "adminArticleImageUrls": result = await adminArticleImageUrls(ctx, input.data); break;
      case "adminArticleInteractions": result = await adminArticleInteractions(ctx, input.data.id); break;
      case "adminSavePoll": result = await adminSavePoll(ctx, input.data); break;
      case "adminDeletePoll": result = await adminDeletePoll(ctx, input.data.id); break;
      case "adminListArticleComments": result = await adminListArticleComments(ctx, input.data.filter); break;
      case "adminModerateArticleComment": result = await adminModerateArticleComment(ctx, input.data); break;
    }
    return Response.json(result, { headers: corsHeaders(origin) });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status, headers: corsHeaders(origin) });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "validation_error", message: error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400, headers: corsHeaders(origin) });
    }
    console.error("TNB articles function failed");
    return Response.json({ error: "internal_error", message: "Wystąpił błąd serwera." }, { status: 500, headers: corsHeaders(origin) });
  }
});
