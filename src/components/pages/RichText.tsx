import { Fragment, type CSSProperties, type ReactNode } from "react";
import { TextFormatSchema, type RichNode, type TextFormat } from "@/lib/rich-text";

export function RichText({ format, fallback, inline = false }: { format?: TextFormat | undefined; fallback: ReactNode; inline?: boolean }) {
  const parsed = format && TextFormatSchema.safeParse(format);
  if (!parsed || !parsed.success) return <>{fallback}</>;
  const f = parsed.data;
  const render = (n: RichNode, key: number): ReactNode => {
    const children = n.content?.map(render);
    const style: CSSProperties = { textAlign: n.attrs?.['textAlign'] as CSSProperties['textAlign'] };
    if (n.type === "text") {
      let text: ReactNode = n.text;
      for (const [i, m] of (n.marks ?? []).entries()) {
        const k = `${key}-${i}`;
        if (m.type === "bold") text = <strong key={k}>{text}</strong>;
        if (m.type === "italic") text = <em key={k}>{text}</em>;
        if (m.type === "underline") text = <u key={k}>{text}</u>;
        if (m.type === "strike") text = <s key={k}>{text}</s>;
        if (m.type === "subscript") text = <sub key={k}>{text}</sub>;
        if (m.type === "superscript") text = <sup key={k}>{text}</sup>;
        if (m.type === "textStyle") text = <span key={k} style={{ fontFamily: m.attrs?.['fontFamily'] as string, fontSize: m.attrs?.['fontSize'] as string, color: m.attrs?.['color'] as string, backgroundColor: m.attrs?.['backgroundColor'] as string }}>{text}</span>;
        if (m.type === "highlight") text = <mark key={k} style={{ backgroundColor: (m.attrs?.['color'] as string) || "var(--color-gold)", color: "var(--background)" }}>{text}</mark>;
        if (m.type === "link") text = <a key={k} href={m.attrs?.['href'] as string} target="_blank" rel="noopener noreferrer" className="underline">{text}</a>;
      }
      return <Fragment key={key}>{text}</Fragment>;
    }
    if (n.type === "hardBreak") return <br key={key} />;
    if (inline) return <span key={key} className={n.type === "paragraph" ? "rich-inline-paragraph" : undefined} style={style}>{children}</span>;
    switch (n.type) {
      case "doc": return <Fragment key={key}>{children}</Fragment>;
      case "paragraph": return <p key={key} style={style}>{children ?? <br />}</p>;
      case "heading": return <div key={key} role="heading" aria-level={Number(n.attrs?.['level'] ?? 2)} className="rich-heading" style={style}>{children}</div>;
      case "bulletList": return <ul key={key}>{children}</ul>;
      case "orderedList": return <ol key={key} start={Number(n.attrs?.['start'] ?? 1)}>{children}</ol>;
      case "listItem": return <li key={key}>{children}</li>;
      case "blockquote": return <blockquote key={key}>{children}</blockquote>;
      case "horizontalRule": return <hr key={key} />;
      default: return null;
    }
  };
  const style: CSSProperties = { width: `${f.width ?? 100}%`, maxWidth: "100%", marginLeft: f.position === "center" || f.position === "right" ? "auto" : 0, marginRight: f.position === "center" || f.position === "left" ? "auto" : 0, paddingLeft: f.indent, paddingTop: f.spaceBefore, paddingBottom: f.spaceAfter, lineHeight: f.lineHeight };
  return inline ? <span className="cms-rich-text rich-inline" style={style}>{f.doc.content?.map(render)}</span> : <div className="cms-rich-text" style={style}>{f.doc.content?.map(render)}</div>;
}