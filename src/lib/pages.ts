import type { TextFormat } from "./rich-text";
// Shared, browser-safe model for CMS pages (O TNB, Moja historia and future subpages).
export type PageButton = { label: string; href: string; variant?: "solid" | "outline" | "link"; icon?: "arrow" | "play" | "none"; hidden?: boolean };
export type PageItem = { title: string; body: string; image?: string | null; asset?: string | null; imageAlt?: string; href?: string; hidden?: boolean; align?: "left" | "center" | "right"; focalX?: number; focalY?: number; icon?: "users" | "book" | "shield" | "family" | "target" | "none" };
export type SectionKind = "hero" | "text" | "values" | "columns" | "quote" | "image" | "cta" | "cinematic" | "value-strip" | "home-nav";
export type ImageDisplay = "full" | "inset" | "featured";
export const IMAGE_DISPLAY: Record<ImageDisplay, string> = { full: "Pełna szerokość", inset: "W kolumnie tekstu", featured: "Wyróżniony blok" };
export type PageSection = {
  id: string;
  kind: SectionKind;
  eyebrow: string;
  layout: "left" | "right"; // image side for hero/text sections
  display: ImageDisplay; // how an "image" section is shown
  decorative: boolean; // decorative images get empty alt text
  heading: string;
  body: string;
  image: string | null; // storage file name inside the page folder
  imageAlt: string;
  caption: string;
  quoteAuthor: string;
  buttons: PageButton[];
  items: PageItem[]; // value cards or the two columns of a comparison
  hidden?: boolean; // hidden sections stay in the page but are not shown publicly
  optional?: boolean; // "opcjonalna treść": intentionally empty, no pre-publish warning
  textFormats?: Record<string, TextFormat>;
  appearance?: { height?: number; padding?: number; gap?: number; width?: number; overlay?: number; tone?: "copper" | "gold" | "text"; align?: "left" | "center" | "right" };
};
export type PublicPage = {
  id: string; slug: string; system_key: string | null; title: string; intro: string;
  sections: PageSection[]; seo_title: string; seo_description: string; published_at: string | null; updated_at: string;
  status?: string; legal_approved?: boolean;
};

export const SYSTEM_PAGES: Record<string, { path: string; label: string }> = {
  "home": { path: "/", label: "Strona główna" },
  "o-tnb": { path: "/o-tnb", label: "O TNB" },
  "moja-historia": { path: "/moja-historia", label: "Moja historia" },
  "regulamin": { path: "/regulamin", label: "Regulamin" },
  "polityka-prywatnosci": { path: "/polityka-prywatnosci", label: "Polityka prywatności" },
  "polityka-cookies": { path: "/polityka-cookies", label: "Polityka cookies" },
};
export const pagePath = (p: { slug: string; system_key: string | null }) =>
  (p.system_key && SYSTEM_PAGES[p.system_key]?.path) || `/strony/${p.slug}`;

export const PAGE_STATUS: Record<string, string> = { draft: "Szkic", published: "Opublikowana", archived: "Zarchiwizowana" };

export const SECTION_KINDS: Record<SectionKind, string> = {
  cinematic: "Filmowe otwarcie", "value-strip": "Pas wartości", "home-nav": "Nagłówek strony głównej",
  hero: "Otwarcie strony", text: "Tekst (opcjonalnie ze zdjęciem)", values: "Karty wartości", columns: "Dwie kolumny (listy)",
  quote: "Cytat", image: "Zdjęcie", cta: "Wezwanie do działania",
};

export const newSection = (kind: SectionKind = "text"): PageSection => ({
  id: Math.random().toString(36).slice(2, 10), kind, eyebrow: "", layout: "right", display: "full", decorative: false, heading: "", body: "", image: null, imageAlt: "", caption: "", quoteAuthor: "", buttons: [], hidden: false,
  items: kind === "columns" ? [{ title: "", body: "" }, { title: "", body: "" }] : [],
});

// Older rows lack the newer fields — fill defaults so every renderer can rely on them.
export const normalizeSections = (raw: unknown): PageSection[] =>
  (Array.isArray(raw) ? raw : []).map((s: any) => ({ ...newSection(s?.kind ?? "text"), ...s, items: Array.isArray(s?.items) ? s.items : [], buttons: Array.isArray(s?.buttons) ? s.buttons : [] }));

export const pageImageUrl = (pageId: string, file: string) => `/api/public/page-image/${pageId}/${encodeURIComponent(file)}`;

// Internal links start with "/", external must be https; anything else is rejected.
export const isSafeHref = (h: string) => /^\/(?!\/)[\w\-/#?=&.%]*$/.test(h) || /^https:\/\/\S+$/.test(h) || /^mailto:\S+$/.test(h);

// Builder draft: the editable copy of a page; publishing copies it to the public columns.
export type PageDraft = { slug: string; title: string; intro: string; sections: PageSection[]; seo_title: string; seo_description: string };
export type PageVersion = { id: string; kind: "draft" | "publish" | "restore"; created_at: string; snapshot: PageDraft };

// One reference traversal for nested media, previews, authorization and independent templates.
export function pageImageNames(raw: unknown): string[] {
  return [...new Set(normalizeSections(raw).flatMap(s => [s.image, ...s.items.map(it => it.image)]).filter((n): n is string => typeof n === "string" && /^[a-z0-9-]+\.(jpg|png|webp)$/.test(n)))];
}
// Indexed rich-text formats travel together with their items during reorder/delete/copy.
export function reorderItems(s: PageSection, indexes: number[]): Partial<PageSection> {
  const textFormats = Object.fromEntries(Object.entries(s.textFormats ?? {}).filter(([k]) => !k.startsWith("item-")));
  indexes.forEach((old, current) => { for (const field of ["title", "body"]) { const f = s.textFormats?.[`item-${old}-${field}`]; if (f) textFormats[`item-${current}-${field}`] = structuredClone(f); } });
  return { items: indexes.flatMap(i => s.items[i] ? [structuredClone(s.items[i])] : []), textFormats };
}
