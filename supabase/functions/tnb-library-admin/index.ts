import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "npm:zod@3.25.76";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { TNB_LOGO_PNG_BASE64 } from "./watermark-logo.ts";

const CORS = new Headers({ ...corsHeaders, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version", "Access-Control-Max-Age": "86400", "X-Content-Type-Options": "nosniff" });
const BUCKET = "library-files";
const MM = 72 / 25.4;
const WATERMARK = { sizeMm: 8, rightMm: 4, bottomMm: 3 };
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const FILE_TYPES = ["application/pdf", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "video/mp4", "video/webm"];
const EMAIL = /^[^\s@<>"]+@[^\s@<>]+\.[a-z]{2,}$/i;

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: CORS }); }
function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name); if (!raw) continue;
    try { const value = JSON.parse(raw); if (typeof value === "string") return value; if (value && typeof value.default === "string") return value.default; }
    catch { return raw; }
  }
  return null;
}
function createFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
    headers.set("apikey", key); return fetch(input, { ...init, headers });
  };
}
function service() {
  const url = Deno.env.get("SUPABASE_URL"), key = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new HttpError(503, "Usługa Biblioteki jest niedostępna.");
  return createClient(url, key, { global: { fetch: createFetch(key) }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
type Db = ReturnType<typeof service>;
async function requireAdmin(s: Db, req: Request) {
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const { data, error } = await s.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  const user = data.user;
  const { data: allowed, error: roleError } = await s.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (roleError || !allowed) {
    await logEvent(s, { type: "access_denied", actor: user.id, result: "denied" });
    throw new HttpError(403, "Brak uprawnień administratora.");
  }
  return user;
}
async function logEvent(s: Db, e: { type: string; actor?: string | null; objectKind?: string | null; objectId?: string | null; result?: "ok" | "failed" | "denied"; detail?: string | null }) {
  try { await s.from("admin_events").insert({ type: e.type, actor: e.actor ?? null, object_kind: e.objectKind ?? null, object_id: e.objectId ?? null, result: e.result ?? "ok", detail: e.detail?.slice(0, 300) ?? null }); }
  catch (error) { console.error("library admin event log failed", error); }
}
function isPdf(bytes: Uint8Array) { return bytes.length > 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"; }
async function watermarkPdf(bytes: Uint8Array) {
  if (!isPdf(bytes)) throw new HttpError(400, "Plik nie jest prawidłowym dokumentem PDF.");
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes, { updateMetadata: false }); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/encrypt/i.test(message)) throw new HttpError(400, "PDF jest zabezpieczony hasłem lub szyfrowaniem — prześlij wersję bez zabezpieczeń.");
    throw new HttpError(400, "PDF jest uszkodzony lub w nieobsługiwanym formacie.");
  }
  const pages = doc.getPages();
  if (!pages.length) throw new HttpError(400, "PDF nie zawiera żadnych stron.");
  const logo = await doc.embedPng(Uint8Array.from(atob(TNB_LOGO_PNG_BASE64), (c) => c.charCodeAt(0)));
  const size = WATERMARK.sizeMm * MM;
  for (const page of pages) {
    const { x, y, width } = page.getCropBox();
    if (width < 60 * MM) throw new HttpError(400, "Strony są zbyt małe, by bezpiecznie umieścić znak wodny.");
    page.drawImage(logo, { x: x + width - WATERMARK.rightMm * MM - size, y: y + WATERMARK.bottomMm * MM, width: size, height: size });
  }
  doc.setProducer("TATA NA BACZNOŚCI — znak wodny TNB");
  return await doc.save();
}
async function processPdf(s: Db, itemId: string, input: { originalPath: string; name: string; premarked: boolean }) {
  const now = () => new Date().toISOString();
  await s.from("library_item_content").upsert({ item_id: itemId, original_path: input.originalPath, file_path: null, file_name: input.name.slice(0, 200), watermark_status: "pending", watermark_error: null, updated_at: now() });
  await s.from("library_item_content").update({ watermark_status: "processing" }).eq("item_id", itemId);
  try {
    const download = await s.storage.from(BUCKET).download(input.originalPath);
    if (download.error || !download.data) throw new HttpError(500, "Nie udało się odczytać oryginału pliku.");
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    if (!isPdf(bytes)) throw new HttpError(400, "Plik nie jest prawidłowym dokumentem PDF.");
    const marked = input.premarked ? bytes : await watermarkPdf(bytes);
    const path = "files/" + itemId + "/" + crypto.randomUUID() + "-tnb.pdf";
    const upload = await s.storage.from(BUCKET).upload(path, marked, { contentType: "application/pdf", upsert: false });
    if (upload.error) throw new HttpError(500, "Nie udało się zapisać oznaczonej wersji pliku.");
    const { error } = await s.from("library_item_content").update({
      file_path: path, watermark_status: "ready", watermark_source: input.premarked ? "premarked" : "auto",
      watermark_error: null, pdf_generated_at: now(), updated_at: now()
    }).eq("item_id", itemId);
    if (error) throw new HttpError(500, "Nie udało się przypisać oznaczonego pliku.");
    return { status: "ready" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieoczekiwany błąd przetwarzania PDF.";
    await s.from("library_item_content").update({ watermark_status: "failed", watermark_error: message, file_path: null, updated_at: now() }).eq("item_id", itemId);
    return { status: "failed" as const, error: message };
  }
}

const Id = z.string().uuid();
const ItemSchema = z.object({
  id: Id.nullable(),
  title: z.string().trim().min(2).max(200),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120),
  summary: z.string().trim().max(600),
  category: z.string().min(2).max(40),
  kind: z.enum(["article", "guide", "pdf", "video", "audio", "link"]),
  access: z.enum(["public", "members", "premium"]),
  status: z.enum(["draft", "published", "archived"]),
  author_name: z.string().trim().min(1).max(80),
  body: z.string().max(100000),
  price: z.string().trim().max(12).refine((v) => v === "" || /^\d{1,6}([.,]\d{1,2})?$/.test(v)),
  purchasable: z.boolean(),
  payment_product_id: z.string().trim().max(120),
  delivery_method: z.enum(["email_link", "email_attachment", "account_access"]),
  free_delivery: z.enum(["direct", "form_download", "email"]).default("direct"),
  external_url: z.string().trim().max(2000).refine((v) => v === "" || /^https:\/\/\S+$/.test(v))
});
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("adminListLibrary"), data: z.object({
    q: z.string().trim().max(100).default(""), status: z.enum(["all", "draft", "published", "archived"]).default("all"),
    category: z.string().max(40).nullable().default(null), access: z.enum(["public", "members", "premium"]).nullable().default(null)
  }) }),
  z.object({ action: z.literal("adminGetLibraryItem"), data: z.object({ id: Id }) }),
  z.object({ action: z.literal("adminSaveLibraryItem"), data: ItemSchema }),
  z.object({ action: z.literal("adminSetLibraryStatus"), data: z.object({ id: Id, status: z.enum(["draft", "published", "archived"]) }) }),
  z.object({ action: z.literal("adminCreateLibraryUpload"), data: z.object({
    id: Id, target: z.enum(["cover", "file"]), name: z.string().min(1).max(200), type: z.string().max(100),
    size: z.number().int().positive(), premarked: z.boolean().default(false)
  }) }),
  z.object({ action: z.literal("adminFinalizeLibraryUpload"), data: z.object({
    id: Id, target: z.enum(["cover", "file"]), path: z.string().min(1).max(400),
    name: z.string().min(1).max(200), type: z.string().max(100), premarked: z.boolean().default(false)
  }) }),
  z.object({ action: z.literal("adminRetryWatermark"), data: z.object({ id: Id }) }),
  z.object({ action: z.literal("adminLibraryFileUrl"), data: z.object({ id: Id, which: z.enum(["final", "original"]), download: z.boolean().default(false) }) }),
  z.object({ action: z.literal("adminRemoveLibraryFile"), data: z.object({ id: Id, target: z.enum(["cover", "file"]) }) }),
  z.object({ action: z.literal("getLibraryFileUrl"), data: z.object({ slug: z.string().max(120) }) }),
  z.object({ action: z.literal("adminLibraryCoverUrl"), data: z.object({ id: Id }) })
]);

async function handle(s: Db, req: Request, raw: unknown) {
  const input = RequestSchema.parse(raw);
  if (input.action === "getLibraryFileUrl") {
    const url = Deno.env.get("SUPABASE_URL");
    const publishable = envKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
    if (!url || !publishable) throw new HttpError(503, "Usługa Biblioteki jest niedostępna.");
    const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
    const headers: Record<string, string> = {};
    if (token.split(".").length === 3) headers.Authorization = "Bearer " + token;
    const client = createClient(url, publishable, { global: { headers, fetch: createFetch(publishable) }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: item } = await client.from("library_items").select("id,title,access,free_delivery").eq("slug", input.data.slug).eq("status", "published").maybeSingle();
    if (!item) throw new HttpError(404, "Nie znaleziono materiału.");
    const { data: allowed, error: permissionError } = await client.rpc("library_can_read", { _item: item.id });
    if (permissionError || !allowed) throw new HttpError(403, "Nie masz dostępu do tego materiału.");
    if (item.access !== "premium" && item.free_delivery !== "direct") throw new HttpError(403, "Ten materiał odbierzesz po wypełnieniu krótkiego formularza.");
    const { data: content } = await s.from("library_item_content").select("file_path").eq("item_id", item.id).maybeSingle();
    if (!content?.file_path) throw new HttpError(404, "Ten materiał nie ma pliku.");
    const { data: signed, error } = await s.storage.from(BUCKET).createSignedUrl(content.file_path, 300);
    if (error || !signed) throw new HttpError(500, "Nie udało się przygotować pliku.");
    let userId: string | null = null;
    if (headers.Authorization) {
      const { data: userData } = await client.auth.getUser(token);
      userId = userData.user?.id ?? null;
    }
    const now = new Date().toISOString();
    await s.from("library_requests").insert({ item_id: item.id, item_title: item.title, mode: "direct", status: "downloaded", user_id: userId, downloaded_at: now, download_count: 1 });
    return { url: signed.signedUrl };
  }

  const actor = await requireAdmin(s, req);
  if (input.action === "adminListLibrary") {
    let query = s.from("library_items").select("id,slug,title,summary,category,kind,status,access,cover_url,author_name,published_at,created_at,updated_at,price_amount").order("updated_at", { ascending: false }).limit(500);
    if (input.data.status !== "all") query = query.eq("status", input.data.status);
    if (input.data.category) query = query.eq("category", input.data.category);
    if (input.data.access) query = query.eq("access", input.data.access);
    const term = input.data.q.replace(/[%,()*\\]/g, " ");
    if (term.length >= 2) query = query.or("title.ilike.%" + term + "%,summary.ilike.%" + term + "%,slug.ilike.%" + term + "%");
    const { data, error } = await query;
    if (error) throw new HttpError(500, "Nie udało się pobrać materiałów.");
    return data ?? [];
  }
  if (input.action === "adminGetLibraryItem") {
    const { data: item, error } = await s.from("library_items").select("*").eq("id", input.data.id).maybeSingle();
    if (error || !item) throw new HttpError(404, "Nie znaleziono materiału.");
    const { data: content } = await s.from("library_item_content").select("*").eq("item_id", input.data.id).maybeSingle();
    return { item, content: content ?? { body: "", file_path: null, file_name: null, external_url: null } };
  }
  if (input.action === "adminSaveLibraryItem") {
    const d = input.data;
    const price = d.price ? Math.round(Number(d.price.replace(",", ".")) * 100) : null;
    if (d.access === "premium" && d.purchasable && !price) throw new HttpError(400, "Podaj cenę, aby materiał premium był dostępny do zakupu.");
    if (price !== null && price < 100) throw new HttpError(400, "Cena musi wynosić co najmniej 1 zł.");
    const meta = { title: d.title, slug: d.slug, summary: d.summary, category: d.category, kind: d.kind, access: d.access, status: d.status, author_name: d.author_name,
      price_amount: d.access === "premium" ? price : null, purchasable: d.access === "premium" && d.purchasable,
      payment_product_id: d.payment_product_id || null, delivery_method: d.delivery_method, free_delivery: d.free_delivery };
    const saved = d.id
      ? await s.from("library_items").update(meta).eq("id", d.id).select("id").single()
      : await s.from("library_items").insert(meta).select("id").single();
    if (saved.error) {
      if (saved.error.code === "23505") throw new HttpError(409, "Materiał o takim adresie (slug) już istnieje.");
      throw new HttpError(500, "Nie udało się zapisać materiału.");
    }
    const id = saved.data.id as string;
    const { data: previous } = await s.from("library_item_content").select("body").eq("item_id", id).maybeSingle();
    const now = new Date().toISOString(), bodyChanged = (previous?.body ?? "") !== d.body;
    const { error } = await s.from("library_item_content").upsert({ item_id: id, body: d.body, external_url: d.external_url || null, updated_at: now, ...(bodyChanged ? { body_updated_at: now } : {}) });
    await logEvent(s, { type: d.id ? "library_edit" : "library_create", actor: actor.id, objectKind: "library", objectId: id, result: error ? "failed" : "ok", detail: d.title });
    if (error) throw new HttpError(500, "Zapisano dane materiału, ale nie udało się zapisać treści.");
    return { id };
  }
  if (input.action === "adminSetLibraryStatus") {
    const { error } = await s.from("library_items").update({ status: input.data.status }).eq("id", input.data.id);
    await logEvent(s, { type: "library_" + input.data.status, actor: actor.id, objectKind: "library", objectId: input.data.id, result: error ? "failed" : "ok" });
    if (error) throw new HttpError(500, "Nie udało się zmienić statusu.");
    return { ok: true as const };
  }
  if (input.action === "adminCreateLibraryUpload") {
    const d = input.data, allowed = d.target === "cover" ? COVER_TYPES : FILE_TYPES;
    if (!allowed.includes(d.type)) throw new HttpError(400, d.target === "cover" ? "Okładka musi być plikiem JPG, PNG lub WEBP." : "Dozwolone pliki: PDF, MP3, M4A, WAV, MP4, WEBM.");
    const limit = d.target === "cover" ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
    if (d.size > limit) throw new HttpError(413, d.target === "cover" ? "Okładka może mieć maksymalnie 5 MB." : "Plik może mieć maksymalnie 25 MB.");
    const { data: item } = await s.from("library_items").select("id").eq("id", d.id).maybeSingle();
    if (!item) throw new HttpError(404, "Nie znaleziono materiału.");
    const ext = (d.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    const folder = d.target === "cover" ? "covers" : d.type === "application/pdf" ? "originals" : "files";
    const path = folder + "/" + d.id + "/" + crypto.randomUUID() + "." + (d.type === "image/jpeg" && ext === "jpeg" ? "jpg" : ext || "bin");
    const { data: signed, error } = await s.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new HttpError(500, "Nie udało się przygotować przesyłania pliku.");
    return { path, token: signed.token };
  }
  if (input.action === "adminFinalizeLibraryUpload") {
    const d = input.data;
    const allowed = d.target === "cover" ? COVER_TYPES : FILE_TYPES;
    if (!allowed.includes(d.type)) throw new HttpError(400, "Nieprawidłowy typ pliku.");
    const expectedFolder = d.target === "cover" ? "covers" : d.type === "application/pdf" ? "originals" : "files";
    if (!d.path.startsWith(expectedFolder + "/" + d.id + "/") || d.path.includes("..")) throw new HttpError(400, "Nieprawidłowa ścieżka pliku.");
    const info = await s.storage.from(BUCKET).info(d.path);
    if (info.error || !info.data) throw new HttpError(400, "Nie znaleziono przesłanego pliku.");
    const max = d.target === "cover" ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
    if ((info.data.size ?? 0) > max) throw new HttpError(413, "Plik przekracza dopuszczalny rozmiar.");
    if (d.target === "cover") {
      const { error } = await s.from("library_items").update({ cover_url: d.path }).eq("id", d.id);
      if (error) throw new HttpError(500, "Plik przesłano, ale nie udało się przypisać okładki.");
      await logEvent(s, { type: "library_cover_upload", actor: actor.id, objectKind: "library", objectId: d.id, detail: d.name });
      return { path: d.path, watermark: null };
    }
    if (d.type === "application/pdf") {
      const result = await processPdf(s, d.id, { originalPath: d.path, name: d.name, premarked: d.premarked });
      await logEvent(s, { type: d.premarked ? "library_pdf_premarked" : "library_pdf_watermark", actor: actor.id, objectKind: "library", objectId: d.id, result: result.status === "ready" ? "ok" : "failed", detail: result.status === "failed" ? result.error : d.name });
      return { path: null, watermark: result };
    }
    const { error } = await s.from("library_item_content").upsert({ item_id: d.id, file_path: d.path, file_name: d.name.slice(0, 200), original_path: null, watermark_status: "none", watermark_error: null, updated_at: new Date().toISOString() });
    if (error) throw new HttpError(500, "Plik przesłano, ale nie udało się przypisać go do materiału.");
    await logEvent(s, { type: "library_file_upload", actor: actor.id, objectKind: "library", objectId: d.id, detail: d.name });
    return { path: d.path, watermark: null };
  }
  if (input.action === "adminRetryWatermark") {
    const { data: content } = await s.from("library_item_content").select("original_path,file_name,watermark_status").eq("item_id", input.data.id).maybeSingle();
    if (!content?.original_path) throw new HttpError(409, "Brak oryginału PDF do ponownego przetworzenia. Prześlij plik jeszcze raz.");
    if (content.watermark_status === "processing") throw new HttpError(409, "Plik jest właśnie przetwarzany.");
    const result = await processPdf(s, input.data.id, { originalPath: content.original_path, name: content.file_name ?? "material.pdf", premarked: false });
    await logEvent(s, { type: "library_pdf_watermark_retry", actor: actor.id, objectKind: "library", objectId: input.data.id, result: result.status === "ready" ? "ok" : "failed", detail: result.status === "failed" ? result.error : undefined });
    return result;
  }
  if (input.action === "adminLibraryFileUrl") {
    const { data: content } = await s.from("library_item_content").select("file_path,original_path,file_name").eq("item_id", input.data.id).maybeSingle();
    const path = input.data.which === "final" ? content?.file_path : content?.original_path;
    if (!path) throw new HttpError(404, input.data.which === "final" ? "Brak gotowej (oznaczonej) wersji pliku." : "Brak zapisanego oryginału.");
    const options = input.data.download ? { download: content?.file_name ?? "material.pdf" } : undefined;
    const { data: signed, error } = await s.storage.from(BUCKET).createSignedUrl(path, 300, options);
    if (error || !signed) throw new HttpError(500, "Nie udało się przygotować pliku.");
    return { url: signed.signedUrl };
  }
  if (input.action === "adminRemoveLibraryFile") {
    const d = input.data;
    const result = d.target === "cover"
      ? await s.from("library_items").update({ cover_url: null }).eq("id", d.id)
      : await s.from("library_item_content").update({ file_path: null, file_name: null, original_path: null, watermark_status: "none", watermark_error: null, watermark_source: null, pdf_generated_at: null }).eq("item_id", d.id);
    if (result.error) throw new HttpError(500, "Nie udało się usunąć pliku.");
    await logEvent(s, { type: "library_file_removed", actor: actor.id, objectKind: "library", objectId: d.id, detail: d.target });
    return { ok: true as const };
  }
  if (input.action === "adminLibraryCoverUrl") {
    const { data: item } = await s.from("library_items").select("cover_url").eq("id", input.data.id).maybeSingle();
    if (!item?.cover_url) return { url: null };
    const { data: signed } = await s.storage.from(BUCKET).createSignedUrl(item.cover_url, 600);
    return { url: signed?.signedUrl ?? null };
  }
  throw new HttpError(400, "Nieznana operacja.");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ message: "Niedozwolona metoda." }, 405);
  try {
    const s = service(), raw = await req.json().catch(() => null);
    return json(await handle(s, req, raw));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Wystąpił błąd serwera.";
    if (status >= 500) console.error("tnb-library-admin:", message);
    return json({ message }, status);
  }
});
