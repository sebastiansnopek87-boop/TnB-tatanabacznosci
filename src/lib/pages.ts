// Shared, browser-safe model for CMS pages (O TNB, Moja historia and future subpages).
export type PageButton = { label: string; href: string };
export type PageSection = {
  id: string;
  kind: "text" | "quote" | "image";
  heading: string;
  body: string;
  image: string | null; // storage file name inside the page folder
  imageAlt: string;
  caption: string;
  quoteAuthor: string;
  buttons: PageButton[];
};
export type PublicPage = {
  id: string; slug: string; system_key: string | null; title: string; intro: string;
  sections: PageSection[]; seo_title: string; seo_description: string; published_at: string | null; updated_at: string;
};

export const SYSTEM_PAGES: Record<string, { path: string; label: string }> = {
  "o-tnb": { path: "/o-tnb", label: "O TNB" },
  "moja-historia": { path: "/moja-historia", label: "Moja historia" },
};
export const pagePath = (p: { slug: string; system_key: string | null }) =>
  (p.system_key && SYSTEM_PAGES[p.system_key]?.path) || `/strony/${p.slug}`;

export const PAGE_STATUS: Record<string, string> = { draft: "Szkic", published: "Opublikowana", archived: "Zarchiwizowana" };

export const newSection = (kind: PageSection["kind"] = "text"): PageSection => ({
  id: Math.random().toString(36).slice(2, 10), kind, heading: "", body: "", image: null, imageAlt: "", caption: "", quoteAuthor: "", buttons: [],
});

export const pageImageUrl = (pageId: string, file: string) => `/api/public/page-image/${pageId}/${encodeURIComponent(file)}`;

// Internal links start with "/", external must be https; anything else is rejected.
export const isSafeHref = (h: string) => /^\/(?!\/)[\w\-/#?=&.%]*$/.test(h) || /^https:\/\/\S+$/.test(h) || /^mailto:\S+$/.test(h);
