import { assertAdmin, logEvent } from "./admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DraftSection as DraftSectionSchema } from "./pages.functions";
import { newSection, type PageSection } from "./pages";

// "Moje szablony": saved copies of existing builder sections. Images are copied into
// templates/<id>/ on save and copied again into the target page on insert, so pages and
// templates never share files and deleting a template never affects inserted copies.
const BUCKET = "page-images";
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const COLS = "id, name, description, category, scope, sections, created_at, updated_at";
export type BuilderTemplate = { id: string; name: string; description: string; category: string; scope: "element" | "section" | "sections"; sections: PageSection[]; created_at: string; updated_at: string };

const Meta = z.object({ name: z.string().trim().min(1, "Podaj nazwę szablonu.").max(120), description: z.string().trim().max(500).default(""), category: z.string().trim().min(1, "Podaj kategorię.").max(60) });
const imgName = (ext: string) => `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
const ext = (n: string) => n.split(".").pop() ?? "jpg";

async function copyImages(sections: PageSection[], fromDir: string, toDir: string, rename: boolean) {
  const st = (await admin()).storage.from(BUCKET);
  const out: PageSection[] = [];
  for (const s of sections) {
    let image = s.image;
    if (image) {
      const target = rename ? imgName(ext(image)) : image;
      const { error } = await st.copy(`${fromDir}/${image}`, `${toDir}/${target}`);
      image = error ? null : target; // a missing source file never blocks the template
    }
    out.push({ ...s, image });
  }
  return out;
}

export const adminListTemplates = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const { data, error } = await context.supabase.from("builder_templates").select(COLS).order("updated_at", { ascending: false });
  if (error) throw new Error("Nie udało się pobrać szablonów.");
  return data as BuilderTemplate[];
});

export const adminCreateTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Meta.extend({ pageId: z.string().uuid(), scope: z.enum(["element", "section", "sections"]), sections: z.array(DraftSectionSchema).min(1).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { pageId, sections, ...meta } = data;
    const { data: r, error } = await context.supabase.from("builder_templates").insert({ ...meta, sections: [], created_by: context.userId }).select("id").single();
    if (error || !r) throw new Error("Nie udało się zapisać szablonu.");
    const copied = await copyImages(sections as PageSection[], pageId, `templates/${r.id}`, false);
    await context.supabase.from("builder_templates").update({ sections: copied }).eq("id", r.id);
    await logEvent({ type: "builder_template_created", actor: context.userId, objectKind: "builder_template", objectId: r.id, detail: meta.name });
    return { id: r.id as string };
  });

export const adminUpdateTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Meta.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...meta } = data;
    const { error } = await context.supabase.from("builder_templates").update({ ...meta, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error("Nie udało się zapisać zmian.");
    await logEvent({ type: "builder_template_updated", actor: context.userId, objectKind: "builder_template", objectId: id });
    return { ok: true };
  });

export const adminDuplicateTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: t } = await context.supabase.from("builder_templates").select(COLS).eq("id", data.id).maybeSingle();
    if (!t) throw new Error("Nie znaleziono szablonu.");
    const { data: r, error } = await context.supabase.from("builder_templates").insert({ name: data.name, description: t.description, category: t.category, scope: t.scope, sections: [], created_by: context.userId }).select("id").single();
    if (error || !r) throw new Error("Nie udało się zduplikować szablonu.");
    const copied = await copyImages(t.sections as PageSection[], `templates/${t.id}`, `templates/${r.id}`, false);
    await context.supabase.from("builder_templates").update({ sections: copied }).eq("id", r.id);
    await logEvent({ type: "builder_template_duplicated", actor: context.userId, objectKind: "builder_template", objectId: r.id, detail: data.id });
    return { id: r.id as string };
  });

export const adminDeleteTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: t } = await context.supabase.from("builder_templates").select("sections").eq("id", data.id).maybeSingle();
    if (!t) throw new Error("Nie znaleziono szablonu.");
    const { error } = await context.supabase.from("builder_templates").delete().eq("id", data.id);
    if (error) throw new Error("Nie udało się usunąć szablonu.");
    // Only the template's own image copies are removed; pages hold their own copies.
    const files = (t.sections as PageSection[]).map((s) => s.image).filter(Boolean).map((n) => `templates/${data.id}/${n}`);
    if (files.length) await (await admin()).storage.from(BUCKET).remove(files);
    await logEvent({ type: "builder_template_deleted", actor: context.userId, objectKind: "builder_template", objectId: data.id });
    return { ok: true };
  });

// Returns independent sections for the target page: fresh ids, images copied into the page folder.
export const adminInstantiateTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), pageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: t } = await context.supabase.from("builder_templates").select("sections").eq("id", data.id).maybeSingle();
    if (!t) throw new Error("Nie znaleziono szablonu.");
    const copied = await copyImages(structuredClone(t.sections) as PageSection[], `templates/${data.id}`, data.pageId, true);
    await logEvent({ type: "builder_template_inserted", actor: context.userId, objectKind: "page", objectId: data.pageId, detail: data.id });
    return { sections: copied.map((s) => ({ ...s, id: newSection().id })) };
  });

export const adminTemplateImageUrls = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ files: z.array(z.object({ t: z.string().uuid(), n: z.string().regex(/^[a-z0-9-]+\.(jpg|png|webp)$/) })).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.files.length) return {} as Record<string, string>;
    const { data: s } = await (await admin()).storage.from(BUCKET).createSignedUrls(data.files.map((f) => `templates/${f.t}/${f.n}`), 3600);
    const out: Record<string, string> = {};
    (s ?? []).forEach((x, i) => { if (x.signedUrl) out[`${data.files[i]!.t}/${data.files[i]!.n}`] = x.signedUrl; });
    return out;
  });
