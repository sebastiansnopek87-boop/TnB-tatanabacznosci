import { assertAdmin, logEvent } from "./admin-auth.server";
const LOG = (ctx: { userId: string }, type: string, kind: string, id?: string, result: "ok" | "failed" = "ok", detail?: string) => logEvent({ type, actor: ctx.userId, objectKind: kind, objectId: id, result, detail });

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

const BUCKET = "library-files";

export const adminListLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    q: z.string().trim().max(100).default(""),
    status: z.enum(["all", "draft", "published", "archived"]).default("all"),
    category: z.string().max(40).nullable().default(null),
    access: z.enum(["public", "members", "premium"]).nullable().default(null),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("library_items").select("*").order("updated_at", { ascending: false }).limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.category) q = q.eq("category", data.category);
    if (data.access) q = q.eq("access", data.access);
    const s = data.q.replace(/[%,()*\\]/g, " ");
    if (s.length >= 2) q = q.or(`title.ilike.%${s}%,summary.ilike.%${s}%,slug.ilike.%${s}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać materiałów.");
    return rows as Array<{ price_amount: number | null; id: string; slug: string; title: string; summary: string; category: string; kind: string; status: string; access: string; cover_url: string | null; author_name: string; published_at: string | null; created_at: string; updated_at: string }>;
  });

export const adminGetLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: item, error } = await context.supabase.from("library_items").select("*").eq("id", data.id).maybeSingle();
    if (error || !item) throw new Error("Nie znaleziono materiału.");
    const { data: content } = await context.supabase.from("library_item_content").select("*").eq("item_id", data.id).maybeSingle();
    return { item, content: content ?? { body: "", file_path: null, file_name: null, external_url: null } };
  });

const itemSchema = z.object({
  id: z.string().uuid().nullable(),
  title: z.string().trim().min(2, "Tytuł musi mieć co najmniej 2 znaki.").max(200, "Tytuł może mieć maksymalnie 200 znaków."),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Adres (slug) może zawierać tylko małe litery, cyfry i myślniki.").max(120),
  summary: z.string().trim().max(600, "Opis może mieć maksymalnie 600 znaków."),
  category: z.string().min(2, "Wybierz kategorię.").max(40),
  kind: z.enum(["article", "guide", "pdf", "video", "audio", "link"]),
  access: z.enum(["public", "members", "premium"]),
  status: z.enum(["draft", "published", "archived"]),
  author_name: z.string().trim().min(1, "Podaj autora lub redaktora.").max(80),
  body: z.string().max(100000, "Treść jest zbyt długa."),
  price: z.string().trim().max(12).refine((v) => v === "" || /^\d{1,6}([.,]\d{1,2})?$/.test(v), "Cena musi być liczbą, np. 49 lub 49,99."),
  purchasable: z.boolean(),
  payment_product_id: z.string().trim().max(120),
  delivery_method: z.enum(["email_link", "email_attachment", "account_access"]),
  free_delivery: z.enum(["direct", "form_download", "email"]).default("direct"),
  external_url: z.string().trim().max(2000).refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Adres zewnętrzny musi zaczynać się od https://"),
});

export const adminSaveLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => itemSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const price = data.price ? Math.round(Number(data.price.replace(",", ".")) * 100) : null;
    if (data.access === "premium" && data.purchasable && !price) throw new Error("Podaj cenę, aby materiał premium był dostępny do zakupu.");
    if (price !== null && price < 100) throw new Error("Cena musi wynosić co najmniej 1 zł.");
    const meta = { title: data.title, slug: data.slug, summary: data.summary, category: data.category, kind: data.kind, access: data.access, status: data.status, author_name: data.author_name,
      price_amount: data.access === "premium" ? price : null, purchasable: data.access === "premium" && data.purchasable,
      payment_product_id: data.payment_product_id || null, delivery_method: data.delivery_method, free_delivery: data.free_delivery };
    const res = data.id
      ? await db.from("library_items").update(meta).eq("id", data.id).select("id").single()
      : await db.from("library_items").insert(meta).select("id").single();
    if (res.error) {
      if (res.error.code === "23505") throw new Error("Materiał o takim adresie (slug) już istnieje.");
      throw new Error("Nie udało się zapisać materiału.");
    }
    const id = res.data.id as string;
    const { data: prev } = await db.from("library_item_content").select("body").eq("item_id", id).maybeSingle();
    const now = new Date().toISOString();
    const bodyChanged = (prev?.body ?? "") !== data.body;
    const { error } = await db.from("library_item_content").upsert({ item_id: id, body: data.body, external_url: data.external_url || null, updated_at: now, ...(bodyChanged ? { body_updated_at: now } : {}) });
    await LOG(context, data.id ? "library_edit" : "library_create", "library", id, error ? "failed" : "ok", data.title);
    if (error) throw new Error("Zapisano dane materiału, ale nie udało się zapisać treści.");
    return { id };
  });

export const adminSetLibraryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("library_items").update({ status: data.status }).eq("id", data.id);
    await LOG(context, `library_${data.status}`, "library", data.id, error ? "failed" : "ok");
    if (error) throw new Error("Nie udało się zmienić statusu.");
    return { ok: true };
  });

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const FILE_TYPES = ["application/pdf", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "video/mp4", "video/webm"];

export const adminUploadLibraryFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), target: z.enum(["cover", "file"]),
    name: z.string().min(1).max(200), type: z.string().max(100), base64: z.string().max(34_000_000),
    premarked: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const allowed = data.target === "cover" ? COVER_TYPES : FILE_TYPES;
    if (!allowed.includes(data.type)) throw new Error(data.target === "cover" ? "Okładka musi być plikiem JPG, PNG lub WEBP." : "Dozwolone pliki: PDF, MP3, M4A, WAV, MP4, WEBM.");
    const bytes = Buffer.from(data.base64, "base64");
    const max = data.target === "cover" ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
    if (bytes.length > max) throw new Error(data.target === "cover" ? "Okładka może mieć maksymalnie 5 MB." : "Plik może mieć maksymalnie 25 MB.");
    if (data.target === "file" && data.type === "application/pdf") {
      // New PDFs always go through TNB watermarking; only the marked copy is downloadable.
      const { processLibraryPdf } = await import("./library/pdf.server");
      const r = await processLibraryPdf(data.id, { bytes: new Uint8Array(bytes), name: data.name, premarked: data.premarked });
      await LOG(context, data.premarked ? "library_pdf_premarked" : "library_pdf_watermark", "library", data.id, r.status === "ready" ? "ok" : "failed", r.status === "failed" ? r.error : data.name);
      return { path: null, watermark: r };
    }
    const ext = (data.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
    const path = `${data.target === "cover" ? "covers" : "files"}/${data.id}/${Date.now()}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: data.type, upsert: false });
    if (up.error) throw new Error("Nie udało się przesłać pliku.");
    const db = context.supabase;
    const r = data.target === "cover"
      ? await db.from("library_items").update({ cover_url: path }).eq("id", data.id)
      : await db.from("library_item_content").upsert({ item_id: data.id, file_path: path, file_name: data.name.slice(0, 200), original_path: null, watermark_status: "none", watermark_error: null, updated_at: new Date().toISOString() });
    if (r.error) throw new Error("Plik przesłano, ale nie udało się go przypisać do materiału.");
    return { path, watermark: null };
  });

export const adminRetryWatermark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: c } = await context.supabase.from("library_item_content").select("original_path, file_name, watermark_status").eq("item_id", data.id).maybeSingle();
    if (!c?.original_path) throw new Error("Brak oryginału PDF do ponownego przetworzenia. Prześlij plik jeszcze raz.");
    if (c.watermark_status === "processing") throw new Error("Plik jest właśnie przetwarzany.");
    const { processLibraryPdf } = await import("./library/pdf.server");
    const r = await processLibraryPdf(data.id, { originalPath: c.original_path, name: c.file_name ?? "material.pdf", premarked: false });
    await LOG(context, "library_pdf_watermark_retry", "library", data.id, r.status === "ready" ? "ok" : "failed", r.status === "failed" ? r.error : undefined);
    return r;
  });

// Admin preview/control download of the marked file (or the stored original).
export const adminLibraryFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), which: z.enum(["final", "original"]), download: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: c } = await context.supabase.from("library_item_content").select("file_path, original_path, file_name").eq("item_id", data.id).maybeSingle();
    const path = data.which === "final" ? c?.file_path : c?.original_path;
    if (!path) throw new Error(data.which === "final" ? "Brak gotowej (oznaczonej) wersji pliku." : "Brak zapisanego oryginału.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 300, data.download ? { download: c?.file_name ?? "material.pdf" } : undefined);
    if (error || !s) throw new Error("Nie udało się przygotować pliku.");
    return { url: s.signedUrl };
  });

export const adminRemoveLibraryFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), target: z.enum(["cover", "file"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const r = data.target === "cover"
      ? await db.from("library_items").update({ cover_url: null }).eq("id", data.id)
      : await db.from("library_item_content").update({ file_path: null, file_name: null, original_path: null, watermark_status: "none", watermark_error: null, watermark_source: null, pdf_generated_at: null }).eq("item_id", data.id);
    if (r.error) throw new Error("Nie udało się usunąć pliku.");
    return { ok: true };
  });

// Direct download. Works for guests and signed-in users: access is decided by library_can_read as the caller.
// Free materials set to a form/e-mail delivery are refused here — they are served only via a request token.
export const getLibraryFileUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(120) }).parse(d))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const auth = getRequest()?.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const headers: Record<string, string> = token.split(".").length === 3 ? { Authorization: `Bearer ${token}` } : {};
    const client = createClient(url, key, {
      global: { headers, fetch: (i, init) => { const h = new Headers(init?.headers); h.set("apikey", key); if (!headers["Authorization"]) h.delete("Authorization"); return fetch(i, { ...init, headers: h }); } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: item } = await client.from("library_items").select("id, title, access, free_delivery").eq("slug", data.slug).eq("status", "published").maybeSingle();
    if (!item) throw new Error("Nie znaleziono materiału.");
    const { data: ok } = await client.rpc("library_can_read", { _item: item.id });
    if (!ok) throw new Error("Nie masz dostępu do tego materiału.");
    if (item.access !== "premium" && item.free_delivery !== "direct") throw new Error("Ten materiał odbierzesz po wypełnieniu krótkiego formularza.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("library_item_content").select("file_path").eq("item_id", item.id).maybeSingle();
    if (!c?.file_path) throw new Error("Ten materiał nie ma pliku.");
    const { data: signed, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(c.file_path, 300);
    if (error || !signed) throw new Error("Nie udało się przygotować pliku.");
    let userId: string | null = null;
    if (headers["Authorization"]) { const { data: u } = await client.auth.getUser(token); userId = u.user?.id ?? null; }
    const now = new Date().toISOString();
    await supabaseAdmin.from("library_requests").insert({ item_id: item.id, item_title: item.title, mode: "direct", status: "downloaded", user_id: userId, downloaded_at: now, download_count: 1 } as never);
    return { url: signed.signedUrl };
  });

// Admin-only signed cover URL so draft cards can be previewed (public cover route serves published only).
export const adminLibraryCoverUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: it } = await context.supabase.from("library_items").select("cover_url").eq("id", data.id).maybeSingle();
    if (!it?.cover_url) return { url: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(it.cover_url, 600);
    return { url: s?.signedUrl ?? null };
  });
