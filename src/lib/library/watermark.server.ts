// TNB PDF watermark (editorial standard): small original logo in the bottom-right
// footer corner of every page, outside the usual text margins. Pure JS (pdf-lib),
// runs in the Worker. Never returns an unmarked file: any problem throws.
import { PDFDocument } from "pdf-lib";
import { TNB_LOGO_PNG_BASE64 } from "./watermark-logo.server";

const MM = 72 / 25.4;
export const WATERMARK_SPEC = { sizeMm: 8, rightMm: 4, bottomMm: 3 };

export class WatermarkError extends Error {}

export function isPdf(bytes: Uint8Array) {
  return bytes.length > 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
}

export async function watermarkPdf(bytes: Uint8Array): Promise<Uint8Array> {
  if (!isPdf(bytes)) throw new WatermarkError("Plik nie jest prawidłowym dokumentem PDF.");
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/encrypt/i.test(msg)) throw new WatermarkError("PDF jest zabezpieczony hasłem lub szyfrowaniem — nie można dodać znaku wodnego. Prześlij wersję bez zabezpieczeń.");
    throw new WatermarkError("PDF jest uszkodzony lub w nieobsługiwanym formacie.");
  }
  const pages = doc.getPages();
  if (!pages.length) throw new WatermarkError("PDF nie zawiera żadnych stron.");
  const logo = await doc.embedPng(Uint8Array.from(atob(TNB_LOGO_PNG_BASE64), (c) => c.charCodeAt(0)));
  const s = WATERMARK_SPEC.sizeMm * MM;
  for (const p of pages) {
    const { x, y, width } = p.getCropBox();
    // Too small for a footer mark (e.g. tiny labels): refuse rather than cover content.
    if (width < 60 * MM) throw new WatermarkError("Strony są zbyt małe, by bezpiecznie umieścić znak wodny.");
    p.drawImage(logo, { x: x + width - WATERMARK_SPEC.rightMm * MM - s, y: y + WATERMARK_SPEC.bottomMm * MM, width: s, height: s });
  }
  doc.setProducer("TATA NA BACZNOŚCI — znak wodny TNB");
  return await doc.save();
}
