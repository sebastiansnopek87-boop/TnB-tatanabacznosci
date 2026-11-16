// PDF processing for Biblioteka: original kept under originals/, only the marked
// copy becomes the downloadable file. Status: pending -> processing -> ready | failed.
import { watermarkPdf, WatermarkError } from "./watermark.server";

const BUCKET = "library-files";

export async function processLibraryPdf(itemId: string, opts: { bytes?: Uint8Array; originalPath?: string; name: string; premarked: boolean }) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const now = () => new Date().toISOString();
  let bytes = opts.bytes;
  let originalPath = opts.originalPath ?? null;
  if (bytes && !originalPath) {
    originalPath = `originals/${itemId}/${Date.now()}.pdf`;
    const up = await db.storage.from(BUCKET).upload(originalPath, bytes, { contentType: "application/pdf", upsert: false });
    if (up.error) throw new Error("Nie udało się zapisać oryginału pliku.");
  }
  // The previous final file stays unpublished until the new one is ready (no unmarked fallback).
  await db.from("library_item_content").upsert({ item_id: itemId, original_path: originalPath, file_path: null, file_name: opts.name.slice(0, 200),
    watermark_status: "pending", watermark_error: null, updated_at: now() } as never);
  await db.from("library_item_content").update({ watermark_status: "processing" } as never).eq("item_id", itemId);
  try {
    if (!bytes) {
      const dl = await db.storage.from(BUCKET).download(originalPath!);
      if (dl.error || !dl.data) throw new WatermarkError("Nie udało się odczytać oryginału pliku.");
      bytes = new Uint8Array(await dl.data.arrayBuffer());
    }
    const marked = opts.premarked ? bytes : await watermarkPdf(bytes);
    const path = `files/${itemId}/${Date.now()}-tnb.pdf`;
    const up = await db.storage.from(BUCKET).upload(path, marked, { contentType: "application/pdf", upsert: false });
    if (up.error) throw new WatermarkError("Nie udało się zapisać oznaczonej wersji pliku.");
    await db.from("library_item_content").update({ file_path: path, watermark_status: "ready", watermark_source: opts.premarked ? "premarked" : "auto",
      watermark_error: null, pdf_generated_at: now(), updated_at: now() } as never).eq("item_id", itemId);
    return { status: "ready" as const };
  } catch (e) {
    const msg = e instanceof WatermarkError ? e.message : "Nieoczekiwany błąd przetwarzania PDF.";
    await db.from("library_item_content").update({ watermark_status: "failed", watermark_error: msg, file_path: null, updated_at: now() } as never).eq("item_id", itemId);
    return { status: "failed" as const, error: msg };
  }
}
