import { z } from "zod";
export const TEXT_FONTS = ["Jost", "Cormorant Garamond", "Arial", "Georgia", "Verdana", "Tahoma", "Times New Roman", "Courier New"] as const;
export const TEXT_COLORS = { domyslny: "inherit", tekst: "var(--foreground)", zloto: "var(--color-gold)", stonowany: "var(--muted-foreground)", akcent: "var(--accent)", czerwony: "var(--destructive)" } as const;
export type RichNode = { type: string; text?: string | undefined; attrs?: Record<string, string | number | boolean | null> | undefined; marks?: { type: string; attrs?: Record<string, string | number | boolean | null> | undefined }[] | undefined; content?: RichNode[] | undefined };
export type TextFormat = { doc: RichNode; position?: "left" | "center" | "right"; width?: number; indent?: number; spaceBefore?: number; spaceAfter?: number; lineHeight?: number };
const attrs = z.record(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]));
const NodeSchema: z.ZodType<RichNode> = z.lazy(() => z.object({ type: z.enum(["doc", "paragraph", "heading", "text", "hardBreak", "bulletList", "orderedList", "listItem", "blockquote", "horizontalRule"]), text: z.string().max(30000).optional(), attrs: attrs.optional(), marks: z.array(z.object({ type: z.enum(["bold", "italic", "underline", "strike", "textStyle", "highlight", "subscript", "superscript", "link"]), attrs: attrs.optional() }).strict()).max(12).optional(), content: z.array(NodeSchema).max(1000).optional() }).strict());
function validAttrs(node: RichNode, depth = 0, count = { n: 0 }): boolean {
  if (depth > 12 || ++count.n > 4000) return false;
  const check = (a: RichNode["attrs"]) => Object.entries(a ?? {}).every(([k, v]) => {
    if (k === "textAlign") return ["left", "center", "right", "justify", null].includes(v as string | null);
    if (k === "level") return typeof v === "number" && v >= 1 && v <= 3;
    if (k === "start") return typeof v === "number" && v >= 1 && v <= 999;
    if (k === "fontFamily") return v === null || TEXT_FONTS.includes(v as typeof TEXT_FONTS[number]);
    if (k === "fontSize") return v === null || (typeof v === "string" && /^\d+(?:\.\d+)?px$/.test(v) && parseFloat(v) >= 8 && parseFloat(v) <= 96);
    if (k === "color" || k === "backgroundColor") return v === null || Object.values(TEXT_COLORS).includes(v as typeof TEXT_COLORS[keyof typeof TEXT_COLORS]);
    if (k === "href") return typeof v === "string" && (/^https:\/\/[^\s]+$/.test(v) || /^\/(?!\/)[^\s]*$/.test(v) || /^mailto:[^\s]+$/.test(v));
    if (k === "target") return v === null || v === "_blank";
    if (k === "rel") return v === null || v === "noopener noreferrer nofollow";
    if (k === "class") return v === null;
    return false;
  });
  return check(node.attrs) && (node.marks ?? []).every(m => check(m.attrs)) && (node.content ?? []).every(n => validAttrs(n, depth + 1, count));
}
export const TextFormatSchema = z.object({
  doc: NodeSchema.refine(n => n.type === "doc" && JSON.stringify(n).length <= 150000 && validAttrs(n), "Formatowanie tekstu zawiera niedozwolone ustawienia."),
  position: z.enum(["left", "center", "right"]).optional(), width: z.number().min(25).max(100).optional(),
  indent: z.number().min(0).max(120).optional(), spaceBefore: z.number().min(0).max(160).optional(), spaceAfter: z.number().min(0).max(160).optional(), lineHeight: z.number().min(1).max(3).optional(),
}).strict();
export const TextFormatsSchema = z.record(z.string().regex(/^(eyebrow|heading|body|quoteAuthor|caption|item-\d{1,2}-(title|body))$/), TextFormatSchema).refine(v => Object.keys(v).length <= 29).optional();
export const plainDoc = (text: string): RichNode => ({ type: "doc", content: text.split(/\n\s*\n/).map(p => ({ type: "paragraph", content: p ? p.split("\n").flatMap((line, i) => [...(i ? [{ type: "hardBreak" }] : []), ...(line ? [{ type: "text", text: line }] : [])]) : [] })) });
export function richPlainText(doc: RichNode): string {
  const read = (n: RichNode): string => n.type === "text" ? n.text ?? "" : n.type === "hardBreak" ? "\n" : (n.content ?? []).map(read).join(["doc", "bulletList", "orderedList", "listItem"].includes(n.type) ? "\n\n" : "");
  return read(doc);
}