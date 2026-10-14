import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertSuperadmin, logEvent } from "./admin-auth.server";

// Branding files live in the private "media" bucket under brand/<uuid>.<ext> and are
// served only through /api/public/brand/$file after a reference check in brand_settings.
// No new bucket, no new table — platform_settings.brand_settings only (DB CHECK enforces
// the same allowlist via brand_settings_are_public).
const BUCKET = "media";
const BRAND_DIR = "brand";
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const FILE_RE = /^brand\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|ico)$/;
const MIME_EXT: Record<string, string[]> = {
  "image/png": ["png", "ico"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/x-icon": ["ico"],
  "image/vnd.microsoft.icon": ["ico"],
};
const IMAGE_KEYS = ["logo", "favicon", "og_image", "header_image"] as const;

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export type BrandSettings = Record<string, string>;

export const getBrandSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data, error } = await db.from("platform_settings").select("brand_settings").eq("id", 1).maybeSingle();
    if (error) throw new Error("Nie udało się pobrać ustawień marki.");
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" });
    return { settings: (data?.brand_settings ?? {}) as BrandSettings, canEdit: !!isSuper };
  });

export const createBrandUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().min(1).max(200), type: z.string().max(100), size: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, "brand");
    const ext = (data.name.split(".").pop() ?? "").toLowerCase();
    const exts = MIME_EXT[data.type];
    if (!exts || !exts.includes(ext)) {
      await logEvent({ type: "brand_upload", actor: context.userId, objectKind: "brand", result: "denied", detail: `Niedozwolony format: ${data.type || "nieznany"} (.${ext.slice(0, 8)})` });
      throw new Error("Niedozwolony format pliku. Dozwolone: PNG, JPG, WEBP, ICO.");
    }
    if (data.size > MAX_SIZE) throw new Error("Plik może mieć maksymalnie 2 MB.");
    const path = `${BRAND_DIR}/${crypto.randomUUID()}.${ext === "jpeg" ? "jpg" : ext}`;
    const { data: s, error } = await (await admin()).storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !s) throw new Error("Nie udało się przygotować przesyłania.");
    return { path: s.path, token: s.token, bucket: BUCKET };
  });

// Re-checks what actually landed in storage; removes it if it breaks the rules.
export const finalizeBrandUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().regex(FILE_RE, "Nieprawidłowa ścieżka pliku.") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, "brand");
    const db = await admin();
    const name = data.path.split("/").pop()!;
    const { data: objs, error } = await db.storage.from(BUCKET).list(BRAND_DIR, { search: name });
    const o = (objs ?? []).find((x) => x.name === name);
    if (error || !o) throw new Error("Nie znaleziono przesłanego pliku.");
    const ext = name.split(".").pop()!;
    const size = Number((o as { metadata?: { size?: number } })?.metadata?.size ?? 0);
    const ok = (MIME_EXT[(o as { metadata?: { mimetype?: string } })?.metadata?.mimetype ?? ""] ?? []).includes(ext) && size <= MAX_SIZE;
    if (!ok) {
      await db.storage.from(BUCKET).remove([data.path]);
      await logEvent({ type: "brand_upload", actor: context.userId, objectKind: "brand", objectId: `${BUCKET}/${data.path}`, result: "denied", detail: "Plik niezgodny z deklarowanym formatem — usunięty" });
      throw new Error("Plik został odrzucony: format niezgodny z dozwolonymi.");
    }
    await logEvent({ type: "brand_upload", actor: context.userId, objectKind: "brand", objectId: `${BUCKET}/${data.path}`, detail: "Przesłano plik marki" });
    return { ok: true as const };
  });

const optFile = z.union([z.string().regex(FILE_RE, "Nieprawidłowa referencja pliku marki."), z.literal("")]).transform((v) => (v === "" ? undefined : v));
const optSize = z.union([z.enum(["small", "medium", "large", "very_large"]), z.literal("")]).transform((v) => (v === "" ? undefined : v));
const optText = (max: number) => z.union([z.string().trim().min(1, "Pole nie może być puste").max(max), z.literal("")]).transform((v) => (v === "" ? undefined : v));
const optUrl = z.union([
  z.string().trim().max(500).regex(/^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(\/[A-Za-z0-9._~/-]*)?$/, "Podaj poprawny publiczny adres zaczynający się od https://"),
  z.literal(""),
]).transform((v) => (v === "" ? undefined : v));

export const brandSchema = z.object({
  logo: optFile,
  favicon: optFile,
  og_image: optFile,
  header_image: optFile,
  header_size: optSize,
  site_name: optText(200),
  public_title: optText(200),
  public_description: optText(2000),
  site_url: optUrl,
}).strict();

export const saveBrandSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => brandSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, "brand");
    const db = await admin();
    const { data: prev } = await db.from("platform_settings").select("brand_settings").eq("id", 1).maybeSingle();
    const previous = ((prev?.brand_settings ?? {}) as BrandSettings);
    const next: BrandSettings = { ...previous };
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) delete next[k];
      else next[k] = v as string;
    }
    const serialized = JSON.stringify(next);
    if (serialized.length > 12000) throw new Error("Ustawienia marki są za duże — usuń niektóre wartości.");
    const { error } = await db.from("platform_settings")
      .update({ brand_settings: next, updated_at: new Date().toISOString(), updated_by: context.userId }).eq("id", 1);
    if (error) {
      await logEvent({ type: "settings_update", actor: context.userId, objectKind: "settings", objectId: "brand", result: "failed", detail: "Zapis ustawień marki odrzucony" });
      if (error.code === "23514") throw new Error("Ustawienia zawierają wartości niedozwolone w publicznych ustawieniach marki.");
      throw new Error("Nie udało się zapisać ustawień marki.");
    }
    // Remove replaced branding files that are no longer referenced anywhere.
    for (const k of IMAGE_KEYS) {
      const before = previous[k];
      if (before && before !== next[k] && !Object.values(next).includes(before)) {
        const r = await db.storage.from(BUCKET).remove([before]);
        await logEvent({ type: "brand_upload", actor: context.userId, objectKind: "brand", objectId: `${BUCKET}/${before}`, result: r.error ? "failed" : "ok", detail: "Usunięto zastąpiony plik marki" });
      }
    }
    const changed = (Object.keys(data) as Array<keyof typeof data>).filter((k) => previous[k] !== (data[k] as string | undefined));
    await logEvent({ type: "settings_update", actor: context.userId, objectKind: "settings", objectId: "brand", detail: changed.length ? `Zmienione pola: ${changed.join(", ")}` : "Bez zmian" });
    return { ok: true as const };
  });
