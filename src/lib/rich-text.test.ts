import { describe, expect, it } from "vitest";
import { TextFormatSchema, TextFormatsSchema, plainDoc, richPlainText } from "./rich-text";
describe("CMS rich text", () => {
  it("keeps paragraph and line breaks in legacy text", () => expect(richPlainText(plainDoc("Pierwszy\nwiersz\n\nDrugi akapit"))).toBe("Pierwszy\nwiersz\n\nDrugi akapit"));
  it("accepts font, justification, marks and layout", () => expect(TextFormatSchema.safeParse({ doc: { type: "doc", content: [{ type: "paragraph", attrs: { textAlign: "justify" }, content: [{ type: "text", text: "TNB", marks: [{ type: "bold" }, { type: "textStyle", attrs: { fontFamily: "Arial", fontSize: "32px", color: "var(--color-gold)" } }] }] }] }, width: 75, position: "center", lineHeight: 1.8 }).success).toBe(true));
  it.each(["javascript:alert(1)", "data:text/html,test", "//evil.example"])("rejects unsafe links %s", href => expect(TextFormatSchema.safeParse({ doc: { type: "doc", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href } }] }] } }).success).toBe(false));
  it("rejects unsafe nodes and attributes", () => {
    expect(TextFormatSchema.safeParse({ doc: { type: "doc", content: [{ type: "script", text: "bad" }] } }).success).toBe(false);
    expect(TextFormatSchema.safeParse({ doc: { type: "doc", attrs: { onerror: "bad" } } }).success).toBe(false);
  });
  it("rejects huge font sizes and unknown field keys", () => {
    expect(TextFormatSchema.safeParse({ doc: { type: "doc", content: [{ type: "text", text: "x", marks: [{ type: "textStyle", attrs: { fontSize: "500px" } }] }] } }).success).toBe(false);
    expect(TextFormatsSchema.safeParse({ password: { doc: plainDoc("x") } }).success).toBe(false);
  });
});