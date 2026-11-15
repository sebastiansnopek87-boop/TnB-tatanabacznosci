import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HOME_KINDS, newSection, type PageSection } from "./_shared/pages.ts";
import { TextFormatsSchema } from "./_shared/rich-text.ts";

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
}
type Context = { supabase: any; supabaseAdmin: any; userId: string };
const BUCKET = "page-images";

const Section = z.object({
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
    href: z.string().max(500).optional(), cta: z.string().max(60).optional(),
    image: z.string().max(100).optional(), alt: z.string().max(200).optional(),
  })).max(12).default([]),
  heading: z.string().max(200), body: z.string().max(20000),
  image: z.string().max(100).nullable(), imageAlt: z.string().max(200),
  caption: z.string().max(300), quoteAuthor: z.string().max(120),
  buttons: z.array(z.object({ label: z.string().max(60), href: z.string().max(500) })).max(4),
}).strict();

const Meta = z.object({
  name: z.string().trim().min(1, "Podaj nazwę szablonu.").max(120),
  description: z.string().trim().max(500).default(""),
  category: z.string().trim().min(1, "Podaj kategorię.").max(60),
});
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("adminListTemplates") }),
  z.object({ action: z.literal("adminCreateTemplate"), data: Meta.extend({
    pageId: z.string().uuid(), scope: z.enum(["element", "section", "sections"]),
    sections: z.array(Section).min(1).max(20),
  }) }),
  z.object({ action: z.literal("adminUpdateTemplate"), data: Meta.extend({ id: z.string().uuid() }) }),
  z.object({ action: z.literal("adminDuplicateTemplate"), data: z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120) }) }),
  z.object({ action: z.literal("adminDeleteTemplate"), data: z.object({ id: z.string().uuid() }) }),
  z.object({ action: z.literal("adminInstantiateTemplate"), data: z.object({ id: z.string().uuid(), pageId: z.string().uuid() }) }),
  z.object({ action: z.literal("adminTemplateImageUrls"), data: z.object({
    files: z.array(z.object({ t: z.string().uuid(), n: z.string().regex(/^[a-z0-9-]+\.(jpg|png|webp)$/) })).max(100),
  }) }),
]);

const ALLOWED_ORIGINS = new Set([
  "https://tatanabacznosci.pl", "https://www.tatanabacznosci.pl",
  "http://localhost:5173", "http://127.0.0.1:5173",
]);
const COLS = "id, name, description, category, scope, sections, created_at, updated_at";

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
function fetchWithKey(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}
function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new ApiError("Usługa jest chwilowo niedostępna.", 503, "backend_not_configured");
  return createClient(url, key, {
    global: { fetch: fetchWithKey(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
async function contextFrom(req: Request): Promise<Context> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new ApiError("Wymagane jest zalogowanie.", 401, "unauthorized");
  const token = header.slice(7).trim();
  const url = Deno.env.get("SUPABASE_URL");
  const publishable = envKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
  if (!token || !url || !publishable) throw new ApiError("Wymagane jest zalogowanie.", 401, "unauthorized");
  const supabase = createClient(url, publishable, {
    global: { fetch: fetchWithKey(publishable), headers: { Authorization: "Bearer " + token } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  const userId = data?.user?.id;
  if (error || typeof userId !== "string" || !userId) throw new ApiError("Sesja jest nieprawidłowa lub wygasła.", 401, "unauthorized");
  return { supabase, supabaseAdmin: adminClient(), userId };
}
async function requireAdmin(ctx: Context) {
  const { data, error } = await ctx.supabaseAdmin.from("user_roles").select("role").eq("user_id", ctx.userId);
  if (error || !(data ?? []).some((row: { role: string }) => row.role === "admin")) throw new ApiError("Brak uprawnień administratora.", 403, "forbidden");
}
async function log(ctx: Context, type: string, kind: string, id: string, detail?: string) {
  const { error } = await ctx.supabaseAdmin.from("admin_events").insert({
    type, actor: ctx.userId, object_kind: kind, object_id: id, result: "ok", detail: detail?.slice(0, 300) ?? null,
  });
  if (error) console.error("TNB template audit log failed");
}
function freshImageName(image: string) {
  return "img-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "." + (image.split(".").pop() ?? "jpg");
}
async function copyImages(ctx: Context, sections: PageSection[], fromDir: string, toDir: string, rename: boolean) {
  const storage = ctx.supabaseAdmin.storage.from(BUCKET);
  const result: PageSection[] = [];
  for (const section of sections) {
    let image = section.image;
    if (image) {
      const target = rename ? freshImageName(image) : image;
      const { error } = await storage.copy(fromDir + "/" + image, toDir + "/" + target);
      image = error ? null : target;
    }
    result.push({ ...section, image });
  }
  return result;
}
async function listTemplates(ctx: Context) {
  await requireAdmin(ctx);
  const { data, error } = await ctx.supabaseAdmin.from("builder_templates").select(COLS).order("updated_at", { ascending: false });
  if (error) throw new ApiError("Nie udało się pobrać szablonów.", 500, "templates_list_failed");
  return data ?? [];
}
async function createTemplate(ctx: Context, input: any) {
  await requireAdmin(ctx);
  const { pageId, sections, ...meta } = input;
  const { data: row, error } = await ctx.supabaseAdmin.from("builder_templates")
    .insert({ ...meta, sections: [], created_by: ctx.userId }).select("id").single();
  if (error || !row) throw new ApiError("Nie udało się zapisać szablonu.", 500, "template_create_failed");
  const copied = await copyImages(ctx, sections as PageSection[], pageId, "templates/" + row.id, false);
  const { error: updateError } = await ctx.supabaseAdmin.from("builder_templates").update({ sections: copied }).eq("id", row.id);
  if (updateError) {
    const files = copied.map((s) => s.image).filter(Boolean).map((name) => "templates/" + row.id + "/" + name);
    if (files.length) await ctx.supabaseAdmin.storage.from(BUCKET).remove(files);
    await ctx.supabaseAdmin.from("builder_templates").delete().eq("id", row.id);
    throw new ApiError("Nie udało się zapisać zawartości szablonu.", 500, "template_sections_failed");
  }
  await log(ctx, "builder_template_created", "builder_template", row.id, meta.name);
  return { id: row.id as string };
}
async function updateTemplate(ctx: Context, input: any) {
  await requireAdmin(ctx);
  const { id, ...meta } = input;
  const { error } = await ctx.supabaseAdmin.from("builder_templates").update({ ...meta, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new ApiError("Nie udało się zapisać zmian.", 500, "template_update_failed");
  await log(ctx, "builder_template_updated", "builder_template", id);
  return { ok: true as const };
}
async function duplicateTemplate(ctx: Context, input: { id: string; name: string }) {
  await requireAdmin(ctx);
  const { data: source, error: readError } = await ctx.supabaseAdmin.from("builder_templates").select(COLS).eq("id", input.id).maybeSingle();
  if (readError || !source) throw new ApiError("Nie znaleziono szablonu.", 404, "template_not_found");
  const { data: row, error } = await ctx.supabaseAdmin.from("builder_templates").insert({
    name: input.name, description: source.description, category: source.category,
    scope: source.scope, sections: [], created_by: ctx.userId,
  }).select("id").single();
  if (error || !row) throw new ApiError("Nie udało się zduplikować szablonu.", 500, "template_duplicate_failed");
  const copied = await copyImages(ctx, structuredClone(source.sections) as PageSection[], "templates/" + source.id, "templates/" + row.id, false);
  const { error: updateError } = await ctx.supabaseAdmin.from("builder_templates").update({ sections: copied }).eq("id", row.id);
  if (updateError) throw new ApiError("Nie udało się skopiować obrazów szablonu.", 500, "template_images_copy_failed");
  await log(ctx, "builder_template_duplicated", "builder_template", row.id, input.id);
  return { id: row.id as string };
}
async function deleteTemplate(ctx: Context, id: string) {
  await requireAdmin(ctx);
  const { data: source, error: readError } = await ctx.supabaseAdmin.from("builder_templates").select("sections").eq("id", id).maybeSingle();
  if (readError || !source) throw new ApiError("Nie znaleziono szablonu.", 404, "template_not_found");
  const { error } = await ctx.supabaseAdmin.from("builder_templates").delete().eq("id", id);
  if (error) throw new ApiError("Nie udało się usunąć szablonu.", 500, "template_delete_failed");
  const files = (source.sections as PageSection[]).map((s) => s.image).filter(Boolean).map((name) => "templates/" + id + "/" + name);
  if (files.length) await ctx.supabaseAdmin.storage.from(BUCKET).remove(files);
  await log(ctx, "builder_template_deleted", "builder_template", id);
  return { ok: true as const };
}
async function instantiateTemplate(ctx: Context, input: { id: string; pageId: string }) {
  await requireAdmin(ctx);
  const { data: source, error } = await ctx.supabaseAdmin.from("builder_templates").select("sections").eq("id", input.id).maybeSingle();
  if (error || !source) throw new ApiError("Nie znaleziono szablonu.", 404, "template_not_found");
  const copied = await copyImages(ctx, structuredClone(source.sections) as PageSection[], "templates/" + input.id, input.pageId, true);
  await log(ctx, "builder_template_inserted", "page", input.pageId, input.id);
  return { sections: copied.map((section) => ({ ...section, id: newSection().id })) };
}
async function imageUrls(ctx: Context, files: { t: string; n: string }[]) {
  await requireAdmin(ctx);
  if (!files.length) return {} as Record<string, string>;
  const { data, error } = await ctx.supabaseAdmin.storage.from(BUCKET)
    .createSignedUrls(files.map((f) => "templates/" + f.t + "/" + f.n), 3600);
  if (error) throw new ApiError("Nie udało się przygotować podglądu szablonów.", 500, "template_preview_failed");
  const output: Record<string, string> = {};
  (data ?? []).forEach((item: any, i: number) => {
    const file = files[i];
    if (file && item.signedUrl) output[file.t + "/" + file.n] = item.signedUrl;
  });
  return output;
}
const ALLOWED_ORIGINS = new Set(["https://tatanabacznosci.pl", "https://www.tatanabacznosci.pl", "http://localhost:5173", "http://127.0.0.1:5173"]);
function cors(origin: string | null) {
  const headers = new Headers({ "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Max-Age": "86400", "Vary": "Origin" });
  if (origin && ALLOWED_ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (origin && !ALLOWED_ORIGINS.has(origin)) return Response.json({ error: "origin_not_allowed", message: "Niedozwolone źródło żądania." }, { status: 403, headers });
  if (req.method !== "POST") return Response.json({ error: "method_not_allowed", message: "Dozwolona jest metoda POST." }, { status: 405, headers });
  let raw: unknown;
  try { raw = await req.json(); } catch { return Response.json({ error: "invalid_json", message: "Nieprawidłowe dane żądania." }, { status: 400, headers }); }
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "validation_error", message: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400, headers });
  try {
    const ctx = await contextFrom(req);
    let result: unknown;
    switch (parsed.data.action) {
      case "adminListTemplates": result = await listTemplates(ctx); break;
      case "adminCreateTemplate": result = await createTemplate(ctx, parsed.data.data); break;
      case "adminUpdateTemplate": result = await updateTemplate(ctx, parsed.data.data); break;
      case "adminDuplicateTemplate": result = await duplicateTemplate(ctx, parsed.data.data); break;
      case "adminDeleteTemplate": result = await deleteTemplate(ctx, parsed.data.data.id); break;
      case "adminInstantiateTemplate": result = await instantiateTemplate(ctx, parsed.data.data); break;
      case "adminTemplateImageUrls": result = await imageUrls(ctx, parsed.data.data.files); break;
    }
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.code, message: error.message }, { status: error.status, headers });
    if (error instanceof z.ZodError) return Response.json({ error: "validation_error", message: error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400, headers });
    console.error("TNB templates function failed");
    return Response.json({ error: "internal_error", message: "Wystąpił błąd serwera." }, { status: 500, headers });
  }
});
