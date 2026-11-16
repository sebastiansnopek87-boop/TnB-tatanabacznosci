import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logEvent } from "./admin-auth.server";

// Central, read-mostly view over the existing private buckets. Files stay where
// their module put them; usage is computed live from the module tables.
const BUCKETS = ["library-files", "podcast-files", "meeting-images", "page-images", "media"] as const;
type Bucket = (typeof BUCKETS)[number];
const MODULE_OF: Record<Bucket, string> = {
  "library-files": "library", "podcast-files": "podcast", "meeting-images": "meetings", "page-images": "pages", media: "unknown",
};
const UPLOAD_BUCKET = "media";
const MAX_UPLOAD = 200 * 1024 * 1024; // = bucket limit set in storage
const ALLOWED: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "image/gif": ["gif"],
  "audio/mpeg": ["mp3"], "audio/mp4": ["m4a", "mp4"], "audio/x-m4a": ["m4a"], "audio/aac": ["aac"], "audio/ogg": ["ogg"], "audio/wav": ["wav"], "audio/x-wav": ["wav"], "audio/webm": ["webm"],
  "application/pdf": ["pdf"], "video/mp4": ["mp4"], "video/webm": ["webm"],
};

const kindOf = (mime: string, name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  if (mime.startsWith("audio/") || ["mp3", "m4a", "wav", "ogg", "aac"].includes(ext)) return "audio";
  if (mime === "application/pdf" || ["pdf", "doc", "docx", "txt"].includes(ext)) return "document";
  return "other";
};

type Usage = { module: string; label: string; title: string; status: string; published: boolean };

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

// Builds "bucket/path" -> usages from every table that stores file paths.
async function buildUsage(): Promise<Map<string, Usage[]>> {
  const db = await admin();
  const [li, lc, pe, me, sp, avatars] = await Promise.all([
    db.from("library_items").select("id, title, status, cover_url"),
    db.from("library_item_content").select("item_id, file_path"),
    db.from("podcast_episodes").select("id, title, status, cover_path, audio_path"),
    db.from("meetings").select("id, title, status, image_url"),
    db.from("site_pages").select("id, title, status, sections"),
    db.from("user_avatars").select("object_path"),
  ]);
  const err = li.error || lc.error || pe.error || me.error || sp.error || avatars.error;
  if (err) throw new Error("Nie udało się ustalić powiązań plików.");
  const map = new Map<string, Usage[]>();
  const add = (key: string | null | undefined, u: Usage) => { if (!key) return; map.set(key, [...(map.get(key) ?? []), u]); };
  const items = new Map((li.data ?? []).map((r) => [r.id, r]));
  for (const r of li.data ?? []) add(r.cover_url && `library-files/${r.cover_url}`, { module: "library", label: "Okładka materiału", title: r.title, status: r.status, published: r.status === "published" });
  for (const c of lc.data ?? []) {
    const it = items.get(c.item_id);
    add(c.file_path && `library-files/${c.file_path}`, { module: "library", label: "Plik materiału", title: it?.title ?? "—", status: it?.status ?? "", published: it?.status === "published" });
  }
  for (const r of pe.data ?? []) {
    const u = { module: "podcast", title: r.title, status: r.status, published: r.status === "published" };
    add(r.cover_path && `podcast-files/${r.cover_path}`, { ...u, label: "Okładka odcinka" });
    add(r.audio_path && `podcast-files/${r.audio_path}`, { ...u, label: "Nagranie odcinka" });
  }
  for (const r of me.data ?? []) add(r.image_url && `meeting-images/${r.image_url}`, { module: "meetings", label: "Grafika spotkania", title: r.title, status: r.status, published: r.status === "published" });
  for (const p of sp.data ?? []) {
    const secs = Array.isArray(p.sections) ? (p.sections as Array<{ image?: unknown }>) : [];
    for (const n of new Set(secs.map((s) => s?.image).filter((x): x is string => typeof x === "string" && !!x))) {
      add(`page-images/${p.id}/${n}`, { module: "pages", label: "Zdjęcie w sekcji strony", title: p.title, status: p.status, published: p.status === "published" });
    }
  }
  for (const a of avatars.data ?? []) add(`media/${a.object_path}`, { module: "account", label: "Avatar użytkownika", title: "Zdjęcie profilowe", status: "active", published: false });
  return map;
}

async function allObjects() {
  const { data, error } = await (await admin()).rpc("admin_media_objects");
  if (error) throw new Error("Nie udało się wczytać listy plików.");
  return (data ?? []) as Array<{ bucket_id: Bucket; name: string; created_at: string; size: number; mimetype: string }>;
}

const toRow = (o: Awaited<ReturnType<typeof allObjects>>[number], usage: Map<string, Usage[]>) => {
  const file = o.name.split("/").pop() ?? o.name;
  const key = `${o.bucket_id}/${o.name}`;
  return {
    bucket: o.bucket_id, path: o.name, file, format: (file.split(".").pop() ?? "").toUpperCase(),
    mime: o.mimetype, size: Number(o.size) || 0, created_at: o.created_at,
    kind: kindOf(o.mimetype, file), module: MODULE_OF[o.bucket_id] ?? "unknown", usages: usage.get(key) ?? [],
  };
};

export const listMedia = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    q: z.string().max(100).default(""),
    kind: z.enum(["", "image", "audio", "document", "other"]).default(""),
    module: z.enum(["", "library", "podcast", "meetings", "pages", "unknown"]).default(""),
    sort: z.enum(["date_desc", "date_asc", "name_asc", "name_desc"]).default("date_desc"),
    page: z.number().int().min(0).max(10000).default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const [objs, usage] = await Promise.all([allObjects(), buildUsage()]);
    const q = data.q.trim().toLowerCase();
    let rows = objs.map((o) => toRow(o, usage)).filter((r) =>
      (!q || r.file.toLowerCase().includes(q) || r.usages.some((u) => u.title.toLowerCase().includes(q)))
      && (!data.kind || r.kind === data.kind) && (!data.module || r.module === data.module));
    const cmp = {
      date_desc: (a: typeof rows[0], b: typeof rows[0]) => b.created_at.localeCompare(a.created_at),
      date_asc: (a: typeof rows[0], b: typeof rows[0]) => a.created_at.localeCompare(b.created_at),
      name_asc: (a: typeof rows[0], b: typeof rows[0]) => a.file.localeCompare(b.file, "pl"),
      name_desc: (a: typeof rows[0], b: typeof rows[0]) => b.file.localeCompare(a.file, "pl"),
    }[data.sort];
    rows = rows.sort(cmp);
    const pageSize = 24;
    return { rows: rows.slice(data.page * pageSize, (data.page + 1) * pageSize), total: rows.length, pageSize };
  });

const Target = z.object({ bucket: z.enum(BUCKETS), path: z.string().min(1).max(400).refine((p) => !p.includes("..")) });

export const getMediaDetail = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Target.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const [objs, usage] = await Promise.all([allObjects(), buildUsage()]);
    const o = objs.find((x) => x.bucket_id === data.bucket && x.name === data.path);
    if (!o) throw new Error("Plik nie istnieje.");
    const row = toRow(o, usage);
    let preview: string | null = null;
    if (row.kind === "image" || row.kind === "audio" || row.mime === "application/pdf" || row.mime.startsWith("video/")) {
      const { data: s } = await (await admin()).storage.from(data.bucket).createSignedUrl(data.path, 600);
      preview = s?.signedUrl ?? null;
    }
    return { ...row, preview, deletable: row.usages.length === 0 };
  });

export const createMediaUpload = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().min(1).max(200), type: z.string().max(100), size: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const ext = (data.name.split(".").pop() ?? "").toLowerCase();
    const exts = ALLOWED[data.type];
    if (!exts || !exts.includes(ext)) {
      await logEvent({ type: "media_rejected", actor: context.userId, objectKind: "media", result: "denied", detail: `Niedozwolony format: ${data.type || "nieznany"} (.${ext.slice(0, 8)})` });
      throw new Error("Niedozwolony format pliku. Dozwolone: JPG, PNG, WEBP, GIF, MP3, M4A, AAC, OGG, WAV, WEBM, PDF, MP4.");
    }
    if (data.size > MAX_UPLOAD) throw new Error("Plik może mieć maksymalnie 200 MB.");
    const base = data.name.slice(0, -(ext.length + 1)).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "plik";
    const d = new Date();
    const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${base}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { data: s, error } = await (await admin()).storage.from(UPLOAD_BUCKET).createSignedUploadUrl(path);
    if (error || !s) throw new Error("Nie udało się przygotować przesyłania.");
    return { path: s.path, token: s.token, bucket: UPLOAD_BUCKET };
  });

// Re-checks what actually landed in storage; removes it if it breaks the rules.
export const finalizeMediaUpload = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().regex(/^\d{4}\/\d{2}\/[a-z0-9-]+\.[a-z0-9]{2,5}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const o = (await allObjects()).find((x) => x.bucket_id === UPLOAD_BUCKET && x.name === data.path);
    if (!o) throw new Error("Nie znaleziono przesłanego pliku.");
    const ext = data.path.split(".").pop() ?? "";
    const ok = (ALLOWED[o.mimetype] ?? []).includes(ext) && Number(o.size) <= MAX_UPLOAD;
    if (!ok) {
      await (await admin()).storage.from(UPLOAD_BUCKET).remove([data.path]);
      await logEvent({ type: "media_rejected", actor: context.userId, objectKind: "media", objectId: `${UPLOAD_BUCKET}/${data.path}`, result: "denied", detail: "Plik niezgodny z deklarowanym formatem — usunięty" });
      throw new Error("Plik został odrzucony: format niezgodny z dozwolonymi.");
    }
    await logEvent({ type: "media_upload", actor: context.userId, objectKind: "media", objectId: `${UPLOAD_BUCKET}/${data.path}`, detail: `${o.mimetype}, ${o.size} B` });
    return { ok: true };
  });

export const deleteMedia = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Target.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const key = `${data.bucket}/${data.path}`;
    let usage: Map<string, Usage[]>;
    try { usage = await buildUsage(); } catch {
      await logEvent({ type: "media_delete", actor: context.userId, objectKind: "media", objectId: key, result: "denied", detail: "Nie udało się ustalić powiązań" });
      throw new Error("Nie można ustalić powiązań pliku — usunięcie zablokowane.");
    }
    const used = usage.get(key) ?? [];
    if (used.length) {
      await logEvent({ type: "media_delete", actor: context.userId, objectKind: "media", objectId: key, result: "denied", detail: `Plik w użyciu: ${used.map((u) => u.title).join(", ")}` });
      throw new Error(`Plik jest używany (${used.map((u) => `${u.label}: ${u.title}`).join("; ")}) — nie można go usunąć.`);
    }
    const { data: removed, error } = await (await admin()).storage.from(data.bucket).remove([data.path]);
    const ok = !error && (removed?.length ?? 0) > 0;
    await logEvent({ type: "media_delete", actor: context.userId, objectKind: "media", objectId: key, result: ok ? "ok" : "failed" });
    if (!ok) throw new Error("Nie udało się usunąć pliku.");
    return { ok: true };
  });
