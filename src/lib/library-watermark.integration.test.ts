import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { watermarkPdf } from "./library/watermark.server";

const PIXEL_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pXcAAAAASUVORK5CYII="),
  (character) => character.charCodeAt(0),
);

async function createSourcePdf() {
  const source = await PDFDocument.create();
  const first = source.addPage([595.28, 841.89]);
  const image = await source.embedPng(PIXEL_PNG);
  first.drawImage(image, { x: 48, y: 620, width: 24, height: 24 });
  first.drawRectangle({ x: 48, y: 560, width: 180, height: 32, borderWidth: 1 });
  const second = source.addPage([420, 595]);
  second.drawRectangle({ x: 36, y: 400, width: 120, height: 24, borderWidth: 1 });
  return new Uint8Array(await source.save());
}

function countEmbeddedImages(document: PDFDocument) {
  return document.context.enumerateIndirectObjects().filter(([, object]) => {
    if (!(object instanceof PDFRawStream)) return false;
    return object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image";
  }).length;
}

describe("PDF watermark preservation", () => {
  it("keeps the source PDF intact and preserves pages, dimensions and embedded images in the marked derivative", async () => {
    const original = await createSourcePdf();
    const originalSnapshot = original.slice();
    const sourceDocument = await PDFDocument.load(original);
    const sourcePages = sourceDocument.getPages().map((page) => {
      const box = page.getCropBox();
      return { width: box.width, height: box.height };
    });
    const sourceImageCount = countEmbeddedImages(sourceDocument);

    const marked = await watermarkPdf(original);
    const markedDocument = await PDFDocument.load(marked, { updateMetadata: false });
    const markedPages = markedDocument.getPages().map((page) => {
      const box = page.getCropBox();
      return { width: box.width, height: box.height };
    });

    expect(original).toEqual(originalSnapshot);
    expect(marked).not.toEqual(original);
    expect(markedPages).toEqual(sourcePages);
    expect(markedDocument.getPageCount()).toBe(2);
    expect(countEmbeddedImages(markedDocument)).toBeGreaterThanOrEqual(sourceImageCount + 2);
    expect(markedDocument.getProducer()).toBe("TATA NA BACZNOŚCI — znak wodny TNB");
  });

  it("rejects a narrow page rather than placing the watermark over content", async () => {
    const source = await PDFDocument.create();
    source.addPage([100, 200]);
    await expect(watermarkPdf(new Uint8Array(await source.save()))).rejects.toThrow("Strony są zbyt małe");
  });

  it("rejects invalid PDF bytes without returning an unmarked fallback", async () => {
    await expect(watermarkPdf(new TextEncoder().encode("not a pdf"))).rejects.toThrow("nie jest prawidłowym dokumentem PDF");
  });
});
