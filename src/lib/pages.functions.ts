import { assertAdmin, logEvent } from "./admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSafeHref, type PageDraft, type PageVersion, type PublicPage } from "./pages";
import { assertLegalPublication, isLegalKey, LEGAL_KEYS } from "./legal-pages";
import { approvalDetail, legalDigest, legalSnapshot } from "./legal-approval";
import { TextFormatsSchema } from "./rich-text";

// Generic CMS for content pages. Public reads: service role, published rows only, safe columns.
// Admin writes: requireSupabaseAuth + assertAdmin + admin-only RLS on site_pages.
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const BUCKET = "page-images";
type Ctx = { supabase: any; userId: string };
const COLS = "id, slug, system_key, title, intro, sections, seo_title, seo_description, published_at, updated_at, status";
const SLUG = z.string().regex(/^[a-z0-9-]{1,120}$/, "Adres może zawierać tylko małe litery, cyfry i myślniki.");

export const getPublicPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ key: z.string().max(60).optional(), slug: SLUG.optional() }).parse(d))
  .handler(async ({ data }): Promise<PublicPage | null> => {
    let q = (await admin()).from("site_pages").select(COLS).eq("status", "published");
    if (data.key) q = q.eq("system_key", data.key); else if (data.slug) q = q.eq("slug", data.slug).is("system_key", null); else return null;
    const { data: p } = await q.maybeSingle();
    if (!p) return null;
    if (isLegalKey(p.system_key)) {
      const digest = await legalDigest(p as unknown as PageDraft);
      const db = await admin();
      const publishedAt = p.published_at ? new Date(p.published_at).toISOString() : null;
      const { data: versions, error } = await db.from("site_page_versions").select("id, snapshot, created_by").eq("page_id", p.id).eq("kind", "publish").contains("snapshot", { _legal: { digest, publishedAt } });
      let approved = false;
      if (!error) for (const v of versions ?? []) {
        if (!v.created_by) continue;
        if (await legalDigest(v.snapshot as unknown as PageDraft) !== digest) continue;
        const { data: event } = await db.from("admin_events").select("id").eq("type", "legal_document_approved").eq("object_kind", "page").eq("object_id", p.id).eq("actor", v.created_by).eq("result", "ok").eq("detail", approvalDetail(v.id, digest)).limit(1);
        if (event?.length) { approved = true; break; }
      }
      return { ...p, legal_approved: approved } as unknown as PublicPage;
    }
    return p as unknown as PublicPage;
  });

// ---------- admin ----------
export const adminListPages = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const { data, error } = await context.supabase.from("site_pages").select("id, slug, system_key, title, status, published_at, updated_at, draft_updated_at").order("system_key", { nullsFirst: false }).order("title");
  if (error) throw new Error("Nie udało się pobrać stron.");
  return data as any[];
});

export const adminGetPage = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: p, error } = await context.supabase.from("site_pages").select("*").eq("id", data.id).maybeSingle();
    if (error || !p) throw new Error("Nie znaleziono strony.");
    return p as any;
  });

export const adminCheckSlug = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(120), id: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!/^[a-z0-9-]{1,120}$/.test(data.slug)) return { ok: false, reason: "Tylko małe litery, cyfry i myślniki." };
    const { data: r } = await context.supabase.from("site_pages").select("id").eq("slug", data.slug).maybeSingle();
    return r && r.id !== data.id ? { ok: false, reason: "Ten adres jest już zajęty." } : { ok: true, reason: "" };
  });

const buttonOptions = { variant: z.enum(["solid", "outline", "link"]).optional(), icon: z.enum(["arrow", "play", "none"]).optional(), hidden: z.boolean().optional() };
const BtnDraft = z.object({ label: z.string().max(60), href: z.string().max(500), ...buttonOptions });
const Btn = z.object({ label: z.string().trim().min(1, "Przycisk musi mieć etykietę.").max(60), href: z.string().trim().max(500).refine(isSafeHref, "Adres przycisku musi zaczynać się od / lub https://"), ...buttonOptions });
const sectionShape = (btn: z.ZodTypeAny) => z.object({
  textFormats: TextFormatsSchema,
  hidden: z.boolean().default(false), optional: z.boolean().default(false),
  id: z.string().regex(/^[a-z0-9]{1,20}$/), kind: z.enum(["hero", "text", "values", "columns", "quote", "image", "cta", "cinematic", "value-strip", "home-nav"]),
  eyebrow: z.string().max(200).default(""), layout: z.enum(["left", "right"]).default("right"), display: z.enum(["full", "inset", "featured"]).default("full"), decorative: z.boolean().default(false),
  appearance: z.object({ height: z.number().min(48).max(720).optional(), padding: z.number().min(0).max(120).optional(), gap: z.number().min(0).max(64).optional(), width: z.number().min(280).max(1600).optional(), overlay: z.number().min(0).max(100).optional(), tone: z.enum(["copper", "gold", "text"]).optional(), align: z.enum(["left", "center", "right"]).optional() }).strict().optional(),
  items: z.array(z.object({ title: z.string().max(120), body: z.string().max(3000), image: z.string().regex(/^[a-z0-9-]+\.(jpg|png|webp)$/).nullable().optional(), asset: z.enum(["before", "expecting", "duty", "father", "after"]).nullable().optional(), imageAlt: z.string().max(200).optional(), href: z.string().max(500).refine(h => !h || isSafeHref(h), "Nieprawidłowy adres elementu").optional(), hidden: z.boolean().optional(), align: z.enum(["left", "center", "right"]).optional(), focalX: z.number().min(0).max(100).optional(), focalY: z.number().min(0).max(100).optional(), icon: z.enum(["users", "book", "shield", "family", "target", "none"]).optional() })).max(12).default([]),
  heading: z.string().max(200), body: z.string().max(20000), image: z.string().regex(/^[a-z0-9-]+\.(jpg|png|webp)$/).nullable(),
  imageAlt: z.string().max(200), caption: z.string().max(300), quoteAuthor: z.string().max(120), buttons: z.array(btn).max(4),
});
const Section = sectionShape(Btn);
export const DraftSection = sectionShape(BtnDraft);
const PageInput = z.object({
  id: z.string().uuid().nullable(), slug: SLUG,
  title: z.string().trim().min(2, "Tytuł musi mieć co najmniej 2 znaki.").max(200), intro: z.string().max(2000),
  sections: z.array(Section).max(40), seo_title: z.string().max(70, "Tytuł SEO: maks. 70 znaków."), seo_description: z.string().max(170, "Opis SEO: maks. 170 znaków."),
});

const SavePageInput = PageInput.extend({ system_key: z.enum(["home", ...LEGAL_KEYS]).nullable().optional() });

export const adminSavePage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SavePageInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, system_key, ...row } = data;
    if (id) {
      const { data: cur } = await context.supabase.from("site_pages").select("system_key, slug, status").eq("id", id).maybeSingle();
      if (!cur) throw new Error("Nie znaleziono strony.");
      if (cur.system_key) row.slug = cur.slug; // fixed URLs of menu pages stay stable
      if (cur.system_key === "home") throw new Error("Stronę główną zapisuj jako szkic w edytorze wizualnym.");
      if (cur.status === "published") assertLegalPublication(cur.system_key, row.sections);
    }
    const q = id
      ? context.supabase.from("site_pages").update({ ...row, draft: null, draft_updated_at: null }).eq("id", id) /* form saves go live; the builder then starts from them */.select("id").single()
      : context.supabase.from("site_pages").insert({ ...row, ...(system_key ? { system_key, slug: system_key } : {}), created_by: context.userId }).select("id").single();
    const { data: r, error } = await q;
    if (error) throw new Error(error.code === "23505" ? "Strona o takim adresie już istnieje." : "Nie udało się zapisać strony.");
    await logEvent({ type: id ? "page_edit" : "page_create", actor: context.userId, objectKind: "page", objectId: r.id, detail: row.slug });
    return { id: r.id as string };
  });

export const adminSetPageStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: { status: string; published_at?: string } = { status: data.status };
    if (data.status === "published") {
      const { data: cur, error } = await context.supabase.from("site_pages").select("system_key, sections").eq("id", data.id).maybeSingle();
      if (error || !cur) throw new Error("Nie znaleziono strony.");
      assertLegalPublication(cur.system_key, cur.sections);
    }
    if (data.status === "published") patch.published_at = new Date().toISOString();
    const { error } = await context.supabase.from("site_pages").update(patch).eq("id", data.id);
    await logEvent({ type: `page_${data.status}`, actor: context.userId, objectKind: "page", objectId: data.id, result: error ? "failed" : "ok" });
    if (error) throw new Error("Nie udało się zmienić statusu.");
    return { ok: true };
  });

const IMAGES = ["image/jpeg", "image/png", "image/webp"];
export const adminCreatePageUpload = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
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

// Signed preview URLs so the admin can see images of drafts.
export const adminPageImageUrls = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), names: z.array(z.string().regex(/^[a-z0-9-]+\.(jpg|png|webp)$/)).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.names.length) return {} as Record<string, string>;
    const { data: s } = await (await admin()).storage.from(BUCKET).createSignedUrls(data.names.map((n) => `${data.id}/${n}`), 3600);
    const out: Record<string, string> = {};
    (s ?? []).forEach((x, i) => { const name = data.names[i]; if (x.signedUrl && name) out[name] = x.signedUrl; });
    return out;
  });

// ---------- Visual Builder: drafts, publishing, versions ----------
// Drafts are loosely validated (work in progress); publishing re-validates with the same strict schema as adminSavePage.
const DraftInput = z.object({
  slug: z.string().max(120), title: z.string().max(200), intro: z.string().max(2000),
  sections: z.array(DraftSection).max(40), seo_title: z.string().max(70), seo_description: z.string().max(170),
});
const firstIssue = (e: unknown) => e instanceof z.ZodError ? e.issues[0]?.message ?? "Nieprawidłowe dane." : "Nieprawidłowe dane.";

async function addVersion(ctx: Ctx, pageId: string, kind: PageVersion["kind"], snapshot: unknown) {
  await ctx.supabase.from("site_page_versions").insert({ page_id: pageId, kind, snapshot, created_by: ctx.userId });
}

export const adminSaveDraft = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), draft: DraftInput, version: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const now = new Date().toISOString();
    const { error } = await context.supabase.from("site_pages").update({ draft: data.draft, draft_updated_at: now }).eq("id", data.id);
    if (error) throw new Error("Nie udało się zapisać szkicu.");
    if (data.version) {
      await addVersion(context, data.id, "draft", data.draft);
      await logEvent({ type: "page_draft_saved", actor: context.userId, objectKind: "page", objectId: data.id });
    }
    return { savedAt: now };
  });

export const adminPublishDraft = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), legalConfirmed: z.boolean().optional(), expectedDigest: z.string().regex(/^[a-f0-9]{64}$/).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: cur } = await context.supabase.from("site_pages").select("*").eq("id", data.id).maybeSingle();
    if (!cur) throw new Error("Nie znaleziono strony.");
    const live = { slug: cur.slug, title: cur.title, intro: cur.intro, sections: cur.sections, seo_title: cur.seo_title, seo_description: cur.seo_description };
    const src = (cur.draft ?? live) as PageDraft;
    let row: z.infer<typeof PageInput>;
    try { row = PageInput.parse({ ...src, id: data.id, slug: cur.system_key ? cur.slug : src.slug }); } catch (e) { throw new Error(firstIssue(e)); }
    assertLegalPublication(cur.system_key, row.sections, data.legalConfirmed === true);
    const { id: _i, ...fields } = row;
    if (isLegalKey(cur.system_key)) {
      const legalFields = fields as unknown as PageDraft;
      const digest = await legalDigest(legalFields);
      if (digest !== data.expectedDigest) throw new Error("Treść zmieniła się od zatwierdzenia. Otwórz ponownie okno publikacji i sprawdź aktualną wersję.");
      const versionId = crypto.randomUUID();
      const publishedAt = new Date().toISOString();
      const { error: versionError } = await context.supabase.from("site_page_versions").insert({ id: versionId, page_id: data.id, kind: "publish", snapshot: { ...legalSnapshot(legalFields), _legal: { digest, publishedAt } }, created_by: context.userId });
      if (versionError) throw new Error("Nie udało się zapisać zatwierdzonej wersji. Dokument nie został opublikowany.");
      await logEvent({ type: "legal_document_approved", actor: context.userId, objectKind: "page", objectId: data.id, detail: approvalDetail(versionId, digest) });
      // logEvent intentionally tolerates failure elsewhere; legal publication fails closed.
      const { data: events, error: eventError } = await (await admin()).from("admin_events").select("id").eq("type", "legal_document_approved").eq("object_kind", "page").eq("object_id", data.id).eq("actor", context.userId).eq("result", "ok").eq("detail", approvalDetail(versionId, digest)).limit(1);
      if (eventError || !events?.length) throw new Error("Nie udało się potwierdzić wpisu zatwierdzenia w dzienniku. Dokument nie został opublikowany.");
      const { data: changed, error: updateError } = await context.supabase.from("site_pages").update({ ...fields, draft: fields, draft_updated_at: publishedAt, status: "published", published_at: publishedAt }).eq("id", data.id).eq("updated_at", cur.updated_at).select("id").maybeSingle();
      if (updateError || !changed) throw new Error("Dokument zmienił się podczas publikacji lub zapis nie powiódł się. Sprawdź wersję i zatwierdź ją ponownie.");
      await logEvent({ type: "page_published", actor: context.userId, objectKind: "page", objectId: data.id, detail: approvalDetail(versionId, digest) });
      return { ok: true };
    }
    // Keep the previous public version recoverable before the first builder publish.
    const { count } = await context.supabase.from("site_page_versions").select("id", { count: "exact", head: true }).eq("page_id", data.id);
    if (!count && cur.status === "published") await addVersion(context, data.id, "publish", live);
    const { error } = await context.supabase.from("site_pages")
      .update({ ...fields, draft: fields, draft_updated_at: new Date().toISOString(), status: "published", published_at: new Date().toISOString() }).eq("id", data.id);
    await logEvent({ type: "page_published", actor: context.userId, objectKind: "page", objectId: data.id, result: error ? "failed" : "ok", detail: "visual builder" });
    if (error) throw new Error(error.code === "23505" ? "Strona o takim adresie już istnieje." : "Nie udało się opublikować.");
    await addVersion(context, data.id, "publish", fields);
    return { ok: true };
  });

export const adminListVersions = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PageVersion[]> => {
    await assertAdmin(context);
    const { data: v, error } = await context.supabase.from("site_page_versions").select("id, kind, created_at, snapshot").eq("page_id", data.id).order("created_at", { ascending: false }).limit(30);
    if (error) throw new Error("Nie udało się pobrać historii.");
    return v as PageVersion[];
  });

export const adminRestoreVersion = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: v } = await context.supabase.from("site_page_versions").select("snapshot").eq("id", data.versionId).eq("page_id", data.id).maybeSingle();
    if (!v) throw new Error("Nie znaleziono wersji.");
    const { error } = await context.supabase.from("site_pages").update({ draft: v.snapshot, draft_updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error("Nie udało się przywrócić wersji.");
    await addVersion(context, data.id, "restore", v.snapshot);
    await logEvent({ type: "page_version_restored", actor: context.userId, objectKind: "page", objectId: data.id, detail: data.versionId });
    return { draft: v.snapshot as PageDraft };
  });
