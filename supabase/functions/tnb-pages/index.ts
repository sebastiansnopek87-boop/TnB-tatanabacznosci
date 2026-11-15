import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HOME_KINDS, isSafeHref, normalizeSections, type PageDraft, type PageVersion, type PublicPage } from "./_shared/pages.ts";
import { assertLegalPublication, isLegalKey, LEGAL_KEYS } from "./_shared/legal-pages.ts";
import { approvalDetail, legalDigest, legalSnapshot } from "./_shared/legal-approval.ts";
import { TextFormatsSchema } from "./_shared/rich-text.ts";

type Context = { supabase: any; supabaseAdmin: any; userId: string };
class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
}
const BUCKET = "page-images";
const COLS = "id, slug, system_key, title, intro, sections, seo_title, seo_description, published_at, updated_at, status";
const SLUG = z.string().regex(/^[a-z0-9-]{1,120}$/, "Adres może zawierać tylko małe litery, cyfry i myślniki.");
const BtnDraft = z.object({ label: z.string().max(60), href: z.string().max(500) });
const Btn = z.object({
  label: z.string().trim().min(1, "Przycisk musi mieć etykietę.").max(60),
  href: z.string().trim().max(500).refine(isSafeHref, "Adres przycisku musi zaczynać się od / lub https://"),
});
const sectionShape = (btn: z.ZodTypeAny) => z.object({
  textFormats: TextFormatsSchema,
  hidden: z.boolean().default(false),
  optional: z.boolean().default(false),
  id: z.string().regex(/^[a-z0-9]{1,20}$/),
  kind: z.enum(["hero", "text", "values", "columns", "quote", "image", "cta", ...HOME_KINDS]),
  settings: z.record(z.string().regex(/^[a-zA-Z0-9]{1,40}$/), z.string().max(3000)).refine((r) => Object.keys(r).length <= 40).optional(),
  eyebrow: z.string().max(200).default(""),
  layout: z.enum(["left", "right"]).default("right"),
  display: z.enum(["full", "inset", "featured"]).default("full"),
  decorative: z.boolean().default(false),
  items: z.array(z.object({
    title: z.string().max(120), body: z.string().max(3000),
    href: z.string().max(500).refine((h) => !h || isSafeHref(h), "Adres musi zaczynać się od / lub https://").optional(),
    cta: z.string().max(60).optional(),
    image: z.string().regex(/^(asset:[a-z-]{1,40}|[a-z0-9-]+\.(jpg|png|webp))$/).optional(),
    alt: z.string().max(200).optional(),
  })).max(12).default([]),
  heading: z.string().max(200), body: z.string().max(20000),
  image: z.string().regex(/^[a-z0-9-]+\.(jpg|png|webp)$/).nullable(),
  imageAlt: z.string().max(200), caption: z.string().max(300), quoteAuthor: z.string().max(120),
  buttons: z.array(btn).max(4),
});
const Section = sectionShape(Btn);
const DraftSection = sectionShape(BtnDraft);
const PageInput = z.object({
  id: z.string().uuid().nullable(), slug: SLUG,
  title: z.string().trim().min(2, "Tytuł musi mieć co najmniej 2 znaki.").max(200),
  intro: z.string().max(2000), sections: z.array(Section).max(40),
  seo_title: z.string().max(70, "Tytuł SEO: maks. 70 znaków."),
  seo_description: z.string().max(170, "Opis SEO: maks. 170 znaków."),
});
const SavePageInput = PageInput.extend({ system_key: z.enum([...LEGAL_KEYS, "home"]).nullable().optional() });
const DraftInput = z.object({
  slug: z.string().max(120), title: z.string().max(200), intro: z.string().max(2000),
  sections: z.array(DraftSection).max(40), seo_title: z.string().max(70), seo_description: z.string().max(170),
});
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("getPublicPage"), data: z.object({ key: z.string().max(60).optional(), slug: SLUG.optional() }) }),
  z.object({ action: z.literal("adminListPages") }),
  z.object({ action: z.literal("adminGetPage"), data: z.object({ id: z.string().uuid() }) }),
  z.object({ action: z.literal("adminCheckSlug"), data: z.object({ slug: z.string().max(120), id: z.string().uuid().nullable() }) }),
  z.object({ action: z.literal("adminSavePage"), data: SavePageInput }),
  z.object({ action: z.literal("adminSetPageStatus"), data: z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }) }),
  z.object({ action: z.literal("adminCreatePageUpload"), data: z.object({ id: z.string().uuid(), type: z.string().max(100), size: z.number().int().positive() }) }),
  z.object({ action: z.literal("adminPageImageUrls"), data: z.object({ id: z.string().uuid(), names: z.array(z.string().regex(/^[a-z0-9-]+\.(jpg|png|webp)$/)).max(40) }) }),
  z.object({ action: z.literal("adminSaveDraft"), data: z.object({ id: z.string().uuid(), draft: DraftInput, version: z.boolean().default(false) }) }),
  z.object({ action: z.literal("adminPublishDraft"), data: z.object({ id: z.string().uuid(), legalConfirmed: z.boolean().optional(), expectedDigest: z.string().regex(/^[a-f0-9]{64}$/).optional() }) }),
  z.object({ action: z.literal("adminListVersions"), data: z.object({ id: z.string().uuid() }) }),
  z.object({ action: z.literal("adminRestoreVersion"), data: z.object({ id: z.string().uuid(), versionId: z.string().uuid() }) }),
  z.object({ action: z.literal("adminStartHomeDraft"), data: z.object({ id: z.string().uuid(), draft: DraftInput }) }),
]);

const ALLOWED_ORIGINS = new Set([
  "https://tatanabacznosci.pl", "https://www.tatanabacznosci.pl",
  "http://localhost:5173", "http://127.0.0.1:5173",
]);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];

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
    if (error) console.error("TNB pages audit event failed");
  } catch { console.error("TNB pages audit event failed"); }
}
async function requireAdmin(ctx: Context): Promise<void> {
  const { data, error } = await ctx.supabaseAdmin.from("user_roles").select("role").eq("user_id", ctx.userId);
  if (error || !(data ?? []).some((row: { role: string }) => row.role === "admin")) {
    await logEvent(ctx, { type: "access_denied", objectKind: "page", result: "denied", detail: "Wymagana rola administratora" });
    throw new ApiError("Brak uprawnień administratora.", 403, "forbidden");
  }
}
function corsHeaders(origin: string | null, publicRead = false): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (publicRead) headers.set("Access-Control-Allow-Origin", "*");
  else if (origin && ALLOWED_ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}
function addHeaders(response: Response, headers: Headers): Response {
  const merged = new Headers(response.headers);
  headers.forEach((value, key) => merged.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}
function publicPageShape(p: any): PublicPage {
  return {
    id: p.id, slug: p.slug, system_key: p.system_key ?? null,
    title: p.title, intro: p.intro, sections: normalizeSections(p.sections),
    seo_title: p.seo_title, seo_description: p.seo_description,
    published_at: p.published_at ?? null, updated_at: p.updated_at, status: p.status,
  } as PublicPage;
}
async function getPublicPage(db: any, input: { key?: string; slug?: string }): Promise<PublicPage | null> {
  let q = db.from("site_pages").select(COLS).eq("status", "published");
  if (input.key) q = q.eq("system_key", input.key);
  else if (input.slug) q = q.eq("slug", input.slug).is("system_key", null);
  else return null;
  const { data: p, error } = await q.maybeSingle();
  if (error || !p) return null;
  const page = publicPageShape(p);
  if (!isLegalKey(p.system_key)) return page;
  const digest = await legalDigest(page as unknown as PageDraft);
  const publishedAt = p.published_at ? new Date(p.published_at).toISOString() : null;
  const { data: versions, error: versionError } = await db.from("site_page_versions")
    .select("id, snapshot, created_by")
    .eq("page_id", p.id).eq("kind", "publish")
    .contains("snapshot", { _legal: { digest, publishedAt } });
  let approved = false;
  if (!versionError) for (const v of versions ?? []) {
    if (!v.created_by || await legalDigest(v.snapshot as PageDraft) !== digest) continue;
    const { data: events } = await db.from("admin_events").select("id")
      .eq("type", "legal_document_approved").eq("object_kind", "page")
      .eq("object_id", p.id).eq("actor", v.created_by).eq("result", "ok")
      .eq("detail", approvalDetail(v.id, digest)).limit(1);
    if (events?.length) { approved = true; break; }
  }
  return { ...page, legal_approved: approved } as PublicPage;
}
async function adminListPages(ctx: Context) {
  await requireAdmin(ctx);
  const { data, error } = await ctx.supabaseAdmin.from("site_pages")
    .select("id, slug, system_key, title, status, published_at, updated_at, draft_updated_at")
    .order("system_key", { nullsFirst: false }).order("title");
  if (error) throw new ApiError("Nie udało się pobrać stron.", 500, "pages_list_failed");
  return data ?? [];
}
async function adminGetPage(ctx: Context, id: string) {
  await requireAdmin(ctx);
  const { data, error } = await ctx.supabaseAdmin.from("site_pages").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new ApiError("Nie znaleziono strony.", 404, "page_not_found");
  return data;
}
async function adminCheckSlug(ctx: Context, input: { slug: string; id: string | null }) {
  await requireAdmin(ctx);
  if (!/^[a-z0-9-]{1,120}$/.test(input.slug)) return { ok: false, reason: "Tylko małe litery, cyfry i myślniki." };
  let q = ctx.supabaseAdmin.from("site_pages").select("id").eq("slug", input.slug);
  if (input.id) q = q.neq("id", input.id);
  const { data, error } = await q.maybeSingle();
  if (error) throw new ApiError("Nie udało się sprawdzić adresu.", 500, "slug_check_failed");
  return data ? { ok: false, reason: "Ten adres jest już zajęty." } : { ok: true, reason: "" };
}
async function adminSavePage(ctx: Context, input: z.infer<typeof SavePageInput>) {
  await requireAdmin(ctx);
  const { id, system_key, ...row } = input;
  if (id) {
    const { data: cur, error: readError } = await ctx.supabaseAdmin.from("site_pages")
      .select("system_key, slug, status").eq("id", id).maybeSingle();
    if (readError || !cur) throw new ApiError("Nie znaleziono strony.", 404, "page_not_found");
    if (cur.system_key) row.slug = cur.slug;
    if (cur.status === "published") assertLegalPublication(cur.system_key, row.sections);
  }
  const q = id
    ? ctx.supabaseAdmin.from("site_pages").update({ ...row, draft: null, draft_updated_at: null }).eq("id", id).select("id").single()
    : ctx.supabaseAdmin.from("site_pages").insert({ ...row, ...(system_key ? { system_key, slug: system_key } : {}), created_by: ctx.userId }).select("id").single();
  const { data, error } = await q;
  if (error || !data) throw new ApiError(error?.code === "23505" ? "Strona o takim adresie już istnieje." : "Nie udało się zapisać strony.", 400, "page_save_failed");
  await logEvent(ctx, { type: id ? "page_edit" : "page_create", objectKind: "page", objectId: data.id, detail: row.slug });
  return { id: data.id as string };
}
async function adminSetPageStatus(ctx: Context, input: { id: string; status: "draft" | "published" | "archived" }) {
  await requireAdmin(ctx);
  const patch: { status: string; published_at?: string } = { status: input.status };
  if (input.status === "published") {
    const { data: cur, error } = await ctx.supabaseAdmin.from("site_pages").select("system_key, sections").eq("id", input.id).maybeSingle();
    if (error || !cur) throw new ApiError("Nie znaleziono strony.", 404, "page_not_found");
    assertLegalPublication(cur.system_key, cur.sections);
    patch.published_at = new Date().toISOString();
  }
  const { error } = await ctx.supabaseAdmin.from("site_pages").update(patch).eq("id", input.id);
  await logEvent(ctx, { type: "page_" + input.status, objectKind: "page", objectId: input.id, result: error ? "failed" : "ok" });
  if (error) throw new ApiError("Nie udało się zmienić statusu.", 500, "page_status_failed");
  return { ok: true as const };
}
async function adminCreatePageUpload(ctx: Context, input: { id: string; type: string; size: number }) {
  await requireAdmin(ctx);
  if (!IMAGE_MIMES.includes(input.type)) throw new ApiError("Zdjęcie musi być plikiem JPG, PNG lub WEBP.", 400, "invalid_image_type");
  if (input.size > 8 * 1024 * 1024) throw new ApiError("Zdjęcie może mieć maksymalnie 8 MB.", 400, "file_too_large");
  const ext = (input.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
  const name = "img-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "." + ext;
  const { data, error } = await ctx.supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(input.id + "/" + name);
  if (error || !data) throw new ApiError("Nie udało się przygotować przesyłania.", 500, "signed_upload_failed");
  return { path: data.path, token: data.token, name };
}
async function adminPageImageUrls(ctx: Context, input: { id: string; names: string[] }) {
  await requireAdmin(ctx);
  if (!input.names.length) return {} as Record<string, string>;
  const { data, error } = await ctx.supabaseAdmin.storage.from(BUCKET)
    .createSignedUrls(input.names.map((n) => input.id + "/" + n), 3600);
  if (error) throw new ApiError("Nie udało się przygotować podglądu zdjęć.", 500, "signed_preview_failed");
  const out: Record<string, string> = {};
  (data ?? []).forEach((item: any, i: number) => {
    const name = input.names[i];
    if (name && item.signedUrl) out[name] = item.signedUrl;
  });
  return out;
}
async function addVersion(ctx: Context, pageId: string, kind: PageVersion["kind"], snapshot: unknown) {
  const { error } = await ctx.supabaseAdmin.from("site_page_versions").insert({ page_id: pageId, kind, snapshot, created_by: ctx.userId });
  if (error) throw new ApiError("Nie udało się zapisać historii wersji.", 500, "page_version_insert_failed");
}
async function adminSaveDraft(ctx: Context, input: { id: string; draft: z.infer<typeof DraftInput>; version: boolean }) {
  await requireAdmin(ctx);
  const now = new Date().toISOString();
  const { error } = await ctx.supabaseAdmin.from("site_pages").update({ draft: input.draft, draft_updated_at: now }).eq("id", input.id);
  if (error) throw new ApiError("Nie udało się zapisać szkicu.", 500, "draft_save_failed");
  if (input.version) {
    await addVersion(ctx, input.id, "draft", input.draft);
    await logEvent(ctx, { type: "page_draft_saved", objectKind: "page", objectId: input.id });
  }
  return { savedAt: now };
}
const firstIssue = (error: unknown) => error instanceof z.ZodError ? error.issues[0]?.message ?? "Nieprawidłowe dane." : "Nieprawidłowe dane.";
async function adminPublishDraft(ctx: Context, input: { id: string; legalConfirmed?: boolean; expectedDigest?: string }) {
  await requireAdmin(ctx);
  const { data: cur, error: readError } = await ctx.supabaseAdmin.from("site_pages").select("*").eq("id", input.id).maybeSingle();
  if (readError || !cur) throw new ApiError("Nie znaleziono strony.", 404, "page_not_found");
  const live = { slug: cur.slug, title: cur.title, intro: cur.intro, sections: cur.sections, seo_title: cur.seo_title, seo_description: cur.seo_description };
  const source = (cur.draft ?? live) as PageDraft;
  let row: z.infer<typeof PageInput>;
  try { row = PageInput.parse({ ...source, id: input.id, slug: cur.system_key ? cur.slug : source.slug }); }
  catch (error) { throw new ApiError(firstIssue(error), 400, "draft_validation_failed"); }
  assertLegalPublication(cur.system_key, row.sections, input.legalConfirmed === true);
  const { id: _id, ...fields } = row;
  if (isLegalKey(cur.system_key)) {
    const digest = await legalDigest(fields as unknown as PageDraft);
    if (digest !== input.expectedDigest) throw new ApiError("Treść zmieniła się od zatwierdzenia. Otwórz ponownie okno publikacji i sprawdź aktualną wersję.", 409, "legal_digest_mismatch");
    const versionId = crypto.randomUUID();
    const publishedAt = new Date().toISOString();
    const { error: verError } = await ctx.supabaseAdmin.from("site_page_versions").insert({
      id: versionId, page_id: input.id, kind: "publish",
      snapshot: { ...legalSnapshot(fields as unknown as PageDraft), _legal: { digest, publishedAt } },
      created_by: ctx.userId,
    });
    if (verError) throw new ApiError("Nie udało się zapisać zatwierdzonej wersji. Dokument nie został opublikowany.", 500, "legal_version_insert_failed");
    const approval = approvalDetail(versionId, digest);
    const { error: eventError } = await ctx.supabaseAdmin.from("admin_events").insert({
      type: "legal_document_approved", actor: ctx.userId, object_kind: "page",
      object_id: input.id, result: "ok", detail: approval,
    });
    if (eventError) throw new ApiError("Nie udało się potwierdzić zatwierdzenia dokumentu. Dokument nie został opublikowany.", 500, "legal_approval_log_failed");
    const { data: changed, error: updateError } = await ctx.supabaseAdmin.from("site_pages")
      .update({ ...fields, draft: fields, draft_updated_at: publishedAt, status: "published", published_at: publishedAt })
      .eq("id", input.id).eq("updated_at", cur.updated_at).select("id").maybeSingle();
    if (updateError || !changed) throw new ApiError("Dokument zmienił się podczas publikacji lub zapis nie powiódł się. Sprawdź wersję i zatwierdź ją ponownie.", 409, "legal_page_changed");
    await logEvent(ctx, { type: "page_published", objectKind: "page", objectId: input.id, detail: approval });
    return { ok: true as const };
  }
  const { count, error: countError } = await ctx.supabaseAdmin.from("site_page_versions").select("id", { count: "exact", head: true }).eq("page_id", input.id);
  if (countError) throw new ApiError("Nie udało się sprawdzić historii wersji.", 500, "page_versions_count_failed");
  if (!count && cur.status === "published") await addVersion(ctx, input.id, "publish", live);
  const publishedAt = new Date().toISOString();
  const { error } = await ctx.supabaseAdmin.from("site_pages").update({
    ...fields, draft: fields, draft_updated_at: publishedAt, status: "published", published_at: publishedAt,
  }).eq("id", input.id);
  await logEvent(ctx, { type: "page_published", objectKind: "page", objectId: input.id, result: error ? "failed" : "ok", detail: "visual builder" });
  if (error) throw new ApiError(error.code === "23505" ? "Strona o takim adresie już istnieje." : "Nie udało się opublikować.", 500, "page_publish_failed");
  await addVersion(ctx, input.id, "publish", fields);
  return { ok: true as const };
}
async function adminListVersions(ctx: Context, id: string): Promise<PageVersion[]> {
  await requireAdmin(ctx);
  const { data, error } = await ctx.supabaseAdmin.from("site_page_versions").select("id, kind, created_at, snapshot").eq("page_id", id).order("created_at", { ascending: false }).limit(30);
  if (error) throw new ApiError("Nie udało się pobrać historii.", 500, "versions_read_failed");
  return data as PageVersion[];
}
async function adminRestoreVersion(ctx: Context, input: { id: string; versionId: string }) {
  await requireAdmin(ctx);
  const { data: version, error: readError } = await ctx.supabaseAdmin.from("site_page_versions").select("snapshot").eq("id", input.versionId).eq("page_id", input.id).maybeSingle();
  if (readError || !version) throw new ApiError("Nie znaleziono wersji.", 404, "version_not_found");
  const { error } = await ctx.supabaseAdmin.from("site_pages").update({ draft: version.snapshot, draft_updated_at: new Date().toISOString() }).eq("id", input.id);
  if (error) throw new ApiError("Nie udało się przywrócić wersji.", 500, "version_restore_failed");
  await addVersion(ctx, input.id, "restore", version.snapshot);
  await logEvent(ctx, { type: "page_version_restored", objectKind: "page", objectId: input.id, detail: input.versionId });
  return { draft: version.snapshot as PageDraft };
}
async function adminStartHomeDraft(ctx: Context, input: { id: string; draft: z.infer<typeof DraftInput> }) {
  await requireAdmin(ctx);
  const { data: current, error } = await ctx.supabaseAdmin.from("site_pages").select("system_key, slug, title, intro, sections, seo_title, seo_description, draft").eq("id", input.id).maybeSingle();
  if (error || !current) throw new ApiError("Nie znaleziono strony.", 404, "page_not_found");
  if (current.system_key !== "home") throw new ApiError("Ta operacja dotyczy wyłącznie strony głównej.", 400, "not_home_page");
  const previous = current.draft ?? {
    slug: current.slug, title: current.title, intro: current.intro, sections: current.sections,
    seo_title: current.seo_title, seo_description: current.seo_description,
  };
  const { error: versionError } = await ctx.supabaseAdmin.from("site_page_versions").insert({
    page_id: input.id, kind: "draft", snapshot: previous, created_by: ctx.userId,
  });
  if (versionError) throw new ApiError("Nie udało się zachować poprzedniego szkicu — nic nie zmieniono.", 500, "home_version_failed");
  const now = new Date().toISOString();
  const { error: updateError } = await ctx.supabaseAdmin.from("site_pages").update({
    draft: { ...input.draft, slug: current.slug }, draft_updated_at: now,
  }).eq("id", input.id);
  if (updateError) throw new ApiError("Nie udało się utworzyć szkicu.", 500, "home_draft_failed");
  await logEvent(ctx, { type: "page_home_draft_started", objectKind: "page", objectId: input.id });
  return { savedAt: now };
}
async function servePublicImage(db: any, pageId: string, name: string) {
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageId);
  if (!validId || !/^[a-z0-9-]+\.(jpg|png|webp)$/.test(name)) return new Response("Not found", { status: 404 });
  const { data: page, error } = await db.from("site_pages").select("status, sections").eq("id", pageId).maybeSingle();
  const used = Array.isArray(page?.sections) && (page.sections as any[]).some((s) =>
    s?.image === name || (Array.isArray(s?.items) && s.items.some((it: any) => it?.image === name))
  );
  if (error || !page || page.status !== "published" || !used) return new Response("Not found", { status: 404 });
  const { data: blob, error: downloadError } = await db.storage.from(BUCKET).download(pageId + "/" + name);
  if (downloadError || !blob) return new Response("Not found", { status: 404 });
  const type = name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new Response(blob, {
    status: 200,
    headers: { "Content-Type": blob.type || type, "Cache-Control": "public, max-age=3600, stale-while-revalidate=300", "X-Content-Type-Options": "nosniff" },
  });
}
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });

  if (req.method === "GET") {
    const image = url.searchParams.get("image");
    if (image) {
      const [id, ...parts] = image.split("/");
      try {
        return addHeaders(await servePublicImage(createAdminClient(), id ?? "", parts.join("/")), corsHeaders(origin, true));
      } catch { return new Response("Not found", { status: 404, headers: corsHeaders(origin, true) }); }
    }
    try {
      const key = url.searchParams.get("key") ?? undefined;
      const slug = url.searchParams.get("slug") ?? undefined;
      return addHeaders(Response.json(await getPublicPage(createAdminClient(), { key, slug })), corsHeaders(origin, true));
    } catch {
      return addHeaders(Response.json(null), corsHeaders(origin, true));
    }
  }

  if (req.method !== "POST") return Response.json({ error: "method_not_allowed", message: "Niedozwolona metoda." }, { status: 405, headers: corsHeaders(origin) });
  if (origin && !ALLOWED_ORIGINS.has(origin)) return Response.json({ error: "origin_not_allowed", message: "Niedozwolone źródło żądania." }, { status: 403, headers: corsHeaders(origin) });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return Response.json({ error: "payload_too_large", message: "Treść żądania jest zbyt duża." }, { status: 413, headers: corsHeaders(origin) });

  let raw: unknown;
  try {
    const body = await req.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) return Response.json({ error: "payload_too_large", message: "Treść żądania jest zbyt duża." }, { status: 413, headers: corsHeaders(origin) });
    raw = JSON.parse(body);
  } catch { return Response.json({ error: "invalid_json", message: "Nieprawidłowe dane żądania." }, { status: 400, headers: corsHeaders(origin) }); }

  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "validation_error", message: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400, headers: corsHeaders(origin) });

  if (parsed.data.action === "getPublicPage") {
    try { return addHeaders(Response.json(await getPublicPage(createAdminClient(), parsed.data.data)), corsHeaders(origin, true)); }
    catch { return addHeaders(Response.json(null), corsHeaders(origin, true)); }
  }

  try {
    const ctx = await createContext(req);
    let result: unknown;
    switch (parsed.data.action) {
      case "adminListPages": result = await adminListPages(ctx); break;
      case "adminGetPage": result = await adminGetPage(ctx, parsed.data.data.id); break;
      case "adminCheckSlug": result = await adminCheckSlug(ctx, parsed.data.data); break;
      case "adminSavePage": result = await adminSavePage(ctx, parsed.data.data); break;
      case "adminSetPageStatus": result = await adminSetPageStatus(ctx, parsed.data.data); break;
      case "adminCreatePageUpload": result = await adminCreatePageUpload(ctx, parsed.data.data); break;
      case "adminPageImageUrls": result = await adminPageImageUrls(ctx, parsed.data.data); break;
      case "adminSaveDraft": result = await adminSaveDraft(ctx, parsed.data.data); break;
      case "adminPublishDraft": result = await adminPublishDraft(ctx, parsed.data.data); break;
      case "adminListVersions": result = await adminListVersions(ctx, parsed.data.data.id); break;
      case "adminRestoreVersion": result = await adminRestoreVersion(ctx, parsed.data.data); break;
      case "adminStartHomeDraft": result = await adminStartHomeDraft(ctx, parsed.data.data); break;
    }
    return Response.json(result, { headers: corsHeaders(origin) });
  } catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.code, message: error.message }, { status: error.status, headers: corsHeaders(origin) });
    if (error instanceof z.ZodError) return Response.json({ error: "validation_error", message: error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400, headers: corsHeaders(origin) });
    console.error("TNB pages function failed");
    return Response.json({ error: "internal_error", message: "Wystąpił błąd serwera." }, { status: 500, headers: corsHeaders(origin) });
  }
});
