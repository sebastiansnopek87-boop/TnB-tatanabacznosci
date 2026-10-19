import type { ReactNode } from "react";
import { RichText } from "@/components/pages/RichText";
import type { PageSection } from "@/lib/pages";

// Shared helpers for home blocks rendered both publicly and inside the Visual Builder.
export type BlockProps = { s?: PageSection | undefined; sel?: string | null | undefined; imageSrc?: ((f: string) => string | undefined) | undefined };
export const editAttrs = (sel: string | null | undefined) => (el: string): Record<string, string> =>
  sel === undefined ? {} : { "data-el": el, ...(sel === el ? { "data-on": "" } : {}) };

// "*słowo*" -> gold accent, keeps the original two-tone typography editable as plain text.
export function Accent({ text }: { text: string }) {
  return <>{text.split(/(\*[^*]+\*)/g).map((p, i) => p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <span key={i} className="text-gold">{p.slice(1, -1)}</span> : p)}</>;
}
export function Txt({ s, k, text, inline = true }: { s: PageSection; k: string; text: string; inline?: boolean }): ReactNode {
  return <RichText format={s.textFormats?.[k]} fallback={<Accent text={text} />} inline={inline} />;
}
export const paras = (t: string) => t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
