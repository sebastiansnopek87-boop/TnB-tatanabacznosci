// Browser-safe model + public reads for the editorial "Artykuły" section.
// Public reads go through RLS: only published rows with published_at <= now() are visible.
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSections, type PageSection, type SectionKind } from "./pages";

export type ArticleCard = {
  id: string; slug: string; title: string; excerpt: string; category: string | null; cover: string | null; cover_alt: string;
  author_name: string; reading_minutes: number; published_at: string | null; updated_at: string;
};
export type Article = ArticleCard & { sections: PageSection[]; seo_title: string; seo_description: string };
export type ArticleCategory = { slug: string; name: string; sort_order: number };
export type HomeMode = "latest" | "featured";

export const ARTICLE_STATUS: Record<string, string> = { draft: "Szkic", published: "Opublikowany", archived: "Zarchiwizowany" };
export const HOME_MODE: Record<HomeMode, string> = { latest: "Trzy najnowsze artykuły", featured: "Wyróżnione artykuły (według kolejności)" };
/** Blocks offered in the article editor (same editor as Strony). */
export const ARTICLE_KINDS: SectionKind[] = ["text", "quote", "image", "cta"];

const CARD = "id, slug, title, excerpt, category, cover, cover_alt, author_name, reading_minutes, published_at, updated_at";

export const articleImageUrl = (id: string, file: string, v?: string) =>
  `/api/public/article-image/${id}/${encodeURIComponent(file)}${v ? `?v=${encodeURIComponent(v)}` : ""}`;

export const fmtArticleDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" }) : "";

export const minutesLabel = (n: number) => `${n} min czytania`;

/** ~200 words per minute over excerpt and every text field of the content blocks. */
export function readingMinutes(excerpt: string, sections: PageSection[]) {
  const text = [excerpt, ...sections.flatMap((s) => [s.heading, s.body, s.caption, ...s.items.flatMap((i) => [i.title, i.body])])].join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export async function listArticleCategories(): Promise<ArticleCategory[]> {
  const { data, error } = await supabase.from("article_categories").select("slug, name, sort_order").order("sort_order").order("name");
  if (error) throw new Error("Nie udało się pobrać kategorii.");
  return data;
}

export async function listArticles(): Promise<ArticleCard[]> {
  const { data, error } = await supabase.from("articles").select(CARD).order("published_at", { ascending: false }).limit(300);
  if (error) throw new Error("Nie udało się pobrać artykułów.");
  return data as ArticleCard[];
}

export async function getArticle(slug: string): Promise<Article | null> {
  const { data, error } = await supabase.from("articles").select(`${CARD}, sections, seo_title, seo_description`).eq("slug", slug).maybeSingle();
  if (error) throw new Error("Nie udało się pobrać artykułu.");
  return data ? ({ ...(data as any), sections: normalizeSections((data as any).sections) } as Article) : null;
}

/** Three articles for the home page; the criterion is an admin setting, never random. */
export async function homeArticles(): Promise<ArticleCard[]> {
  const { data: st } = await supabase.from("article_settings").select("home_mode").eq("id", 1).maybeSingle();
  let q = supabase.from("articles").select(CARD);
  if (st?.home_mode === "featured") q = q.order("featured", { ascending: false }).order("home_order").order("published_at", { ascending: false });
  else q = q.order("published_at", { ascending: false });
  const { data, error } = await q.limit(3);
  if (error) throw new Error("Nie udało się pobrać artykułów.");
  return data as ArticleCard[];
}

export const articlesQuery = () => queryOptions({ queryKey: ["articles", "list"], queryFn: listArticles });
export const articleCategoriesQuery = () => queryOptions({ queryKey: ["articles", "categories"], queryFn: listArticleCategories });
export const articleQuery = (slug: string) => queryOptions({ queryKey: ["articles", "one", slug], queryFn: () => getArticle(slug) });
export const homeArticlesQuery = () => queryOptions({ queryKey: ["articles", "home"], queryFn: homeArticles });
