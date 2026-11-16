import { describe, expect, it } from "vitest";
import { LEGAL_KEYS, assertLegalPublication, hasLegalContent, isLegalKey, legalReady } from "../../supabase/functions/tnb-pages/_shared/legal-pages";
import { approvalDetail, legalDigest, legalSnapshot } from "../../supabase/functions/tnb-pages/_shared/legal-approval";
import { newSection, normalizeSections, pagePath, isSafeHref } from "../../supabase/functions/tnb-pages/_shared/pages";

const page = (sections = [{ ...newSection("text"), body: "Treść dokumentu" }]) => ({
  slug: "regulamin", title: "Regulamin", intro: "", sections, seo_title: "", seo_description: "",
});

describe("React SPA CMS shared model", () => {
  it("recognizes only the supported legal document keys", () => {
    expect(LEGAL_KEYS).toEqual(["regulamin", "polityka-prywatnosci", "polityka-cookies"]);
    for (const key of LEGAL_KEYS) expect(isLegalKey(key)).toBe(true);
    expect(isLegalKey("inne")).toBe(false);
  });
  it("requires visible substantive content, not headings or hidden blocks", () => {
    expect(hasLegalContent([])).toBe(false);
    expect(hasLegalContent([{ ...newSection(), heading: "Nagłówek" }])).toBe(false);
    expect(hasLegalContent([{ ...newSection(), hidden: true, body: "Ukryta treść" }])).toBe(false);
    expect(hasLegalContent(page().sections)).toBe(true);
  });
  it("requires published status, explicit approval and substantive content", () => {
    expect(legalReady("regulamin", { system_key: "regulamin", status: "draft", legal_approved: true, sections: page().sections })).toBe(false);
    expect(legalReady("regulamin", { system_key: "regulamin", status: "published", legal_approved: false, sections: page().sections })).toBe(false);
    expect(legalReady("regulamin", { system_key: "regulamin", status: "published", legal_approved: true, sections: [] })).toBe(false);
    expect(legalReady("regulamin", { system_key: "regulamin", status: "published", legal_approved: true, sections: page().sections })).toBe(true);
  });
  it("fails closed when legal publication lacks content or confirmation", () => {
    expect(() => assertLegalPublication("regulamin", [])).toThrow("uzupełnienia");
    expect(() => assertLegalPublication("regulamin", page().sections)).toThrow("zatwierdzenia");
    expect(() => assertLegalPublication("regulamin", page().sections, true)).not.toThrow();
    expect(() => assertLegalPublication("o-tnb", [])).not.toThrow();
  });
  it("maps system pages to stable routes and normalizes legacy sections", () => {
    expect(pagePath({ slug: "custom", system_key: "regulamin" })).toBe("/regulamin");
    expect(pagePath({ slug: "custom", system_key: null })).toBe("/strony/custom");
    expect(normalizeSections([{ id: "a", kind: "text", heading: "T" }])[0]).toMatchObject({ id: "a", buttons: [], items: [] });
  });
  it("allows only safe internal, HTTPS and mailto links", () => {
    expect(isSafeHref("/biblioteka")).toBe(true);
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("mailto:kontakt@example.com")).toBe(true);
    expect(isSafeHref("//evil.example")).toBe(false);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
  });
  it("creates stable legal digests independent of object key ordering", async () => {
    const original = page();
    const reversed = { ...original, sections: original.sections.map((section) => Object.fromEntries(Object.entries(section).reverse()) as typeof section) };
    expect(await legalDigest(original)).toBe(await legalDigest(reversed));
    expect(await legalDigest({ ...original, intro: "Zmieniona treść" })).not.toBe(await legalDigest(original));
    expect(legalSnapshot(original)).toMatchObject({ slug: "regulamin", title: "Regulamin" });
  });
  it("binds approval audit detail to the exact version and digest", () => {
    expect(approvalDetail("version-1", "a".repeat(64))).toBe("legal-v1:version-1:" + "a".repeat(64));
  });
});
