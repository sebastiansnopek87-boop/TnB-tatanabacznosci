import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };
async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Brak uprawnień administratora.");
}

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
    return rows as Array<{ id: string; slug: string; title: string; summary: string; category: string; kind: string; status: string; access: string; cover_url: string | null; author_name: string; published_at: string | null; created_at: string; updated_at: string }>;
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
  external_url: z.string().trim().max(2000).refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Adres zewnętrzny musi zaczynać się od https://"),
});

export const adminSaveLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => itemSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const meta = { title: data.title, slug: data.slug, summary: data.summary, category: data.category, kind: data.kind, access: data.access, status: data.status, author_name: data.author_name };
    const res = data.id
      ? await db.from("library_items").update(meta).eq("id", data.id).select("id").single()
      : await db.from("library_items").insert(meta).select("id").single();
    if (res.error) {
      if (res.error.code === "23505") throw new Error("Materiał o takim adresie (slug) już istnieje.");
      throw new Error("Nie udało się zapisać materiału.");
    }
    const id = res.data.id as string;
    const { error } = await db.from("library_item_content").upsert({ item_id: id, body: data.body, external_url: data.external_url || null, updated_at: new Date().toISOString() });
    if (error) throw new Error("Zapisano dane materiału, ale nie udało się zapisać treści.");
    return { id };
  });

export const adminSetLibraryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("library_items").update({ status: data.status }).eq("id", data.id);
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
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const allowed = data.target === "cover" ? COVER_TYPES : FILE_TYPES;
    if (!allowed.includes(data.type)) throw new Error(data.target === "cover" ? "Okładka musi być plikiem JPG, PNG lub WEBP." : "Dozwolone pliki: PDF, MP3, M4A, WAV, MP4, WEBM.");
    const bytes = Buffer.from(data.base64, "base64");
    const max = data.target === "cover" ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
    if (bytes.length > max) throw new Error(data.target === "cover" ? "Okładka może mieć maksymalnie 5 MB." : "Plik może mieć maksymalnie 25 MB.");
    const ext = (data.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
    const path = `${data.target === "cover" ? "covers" : "files"}/${data.id}/${Date.now()}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: data.type, upsert: false });
    if (up.error) throw new Error("Nie udało się przesłać pliku.");
    const db = context.supabase;
    const r = data.target === "cover"
      ? await db.from("library_items").update({ cover_url: path }).eq("id", data.id)
      : await db.from("library_item_content").upsert({ item_id: data.id, file_path: path, file_name: data.name.slice(0, 200), updated_at: new Date().toISOString() });
    if (r.error) throw new Error("Plik przesłano, ale nie udało się go przypisać do materiału.");
    return { path };
  });

export const adminRemoveLibraryFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), target: z.enum(["cover", "file"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const r = data.target === "cover"
      ? await db.from("library_items").update({ cover_url: null }).eq("id", data.id)
      : await db.from("library_item_content").update({ file_path: null, file_name: null }).eq("item_id", data.id);
    if (r.error) throw new Error("Nie udało się usunąć pliku.");
    return { ok: true };
  });

// Works for guests and signed-in users: access is decided by library_can_read as the caller.
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
    const { data: item } = await client.from("library_items").select("id").eq("slug", data.slug).eq("status", "published").maybeSingle();
    if (!item) throw new Error("Nie znaleziono materiału.");
    const { data: ok } = await client.rpc("library_can_read", { _item: item.id });
    if (!ok) throw new Error("Nie masz dostępu do tego materiału.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("library_item_content").select("file_path").eq("item_id", item.id).maybeSingle();
    if (!c?.file_path) throw new Error("Ten materiał nie ma pliku.");
    const { data: signed, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(c.file_path, 300);
    if (error || !signed) throw new Error("Nie udało się przygotować pliku.");
    return { url: signed.signedUrl };
  });
