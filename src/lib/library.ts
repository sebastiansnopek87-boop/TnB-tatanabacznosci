import { supabase } from "@/integrations/supabase/client";

export const KINDS = { article: "Artykuł", guide: "Poradnik", pdf: "PDF do pobrania", video: "Materiał wideo", audio: "Nagranie audio", link: "Link zewnętrzny" } as const;
export type Kind = keyof typeof KINDS;
export const ACCESS = { public: "Publiczny", members: "Dla zalogowanych", premium: "Premium" } as const;
export type Access = keyof typeof ACCESS;
export const STATUS = { draft: "Szkic", published: "Opublikowany", archived: "Archiwalny" } as const;
export type Status = keyof typeof STATUS;

export type LibraryItem = {
  id: string; slug: string; title: string; summary: string; category: string; kind: Kind;
  cover_url: string | null; access: Access; author_name: string; published_at: string | null; updated_at: string;
};
export type LibraryContent = { body: string; file_path: string | null; file_name: string | null; external_url: string | null };

const COLS = "id, slug, title, summary, category, kind, cover_url, access, author_name, published_at, updated_at";

export const coverSrc = (it: { id: string; cover_url: string | null; updated_at: string }) =>
  it.cover_url ? `/api/public/library-cover/${it.id}?v=${encodeURIComponent(it.updated_at)}` : null;

export const fmtDay = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" }) : "—";

export async function listCategories() {
  const { data, error } = await supabase.from("library_categories").select("slug, name, sort_order").order("sort_order");
  if (error) throw new Error("Nie udało się pobrać kategorii.");
  return data;
}

export async function listLibrary(f: { q: string; category: string | null; access: Access | null }) {
  let q = supabase.from("library_items").select(COLS).eq("status", "published").order("published_at", { ascending: false }).limit(200);
  if (f.category) q = q.eq("category", f.category);
  if (f.access) q = q.eq("access", f.access);
  const s = f.q.trim().replace(/[%,()*\\]/g, " ").slice(0, 80);
  if (s.length >= 2) q = q.or(`title.ilike.%${s}%,summary.ilike.%${s}%`);
  const { data, error } = await q;
  if (error) throw new Error("Nie udało się pobrać materiałów.");
  return data as LibraryItem[];
}

// Content row is returned only when database rules allow this viewer to read it.
export async function getLibraryItem(slug: string) {
  const { data: item, error } = await supabase.from("library_items").select(COLS).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw new Error("Nie udało się pobrać materiału.");
  if (!item) return null;
  const { data: content } = await supabase.from("library_item_content").select("body, file_path, file_name, external_url").eq("item_id", item.id).maybeSingle();
  return { item: item as LibraryItem, content: (content ?? null) as LibraryContent | null };
}

export function slugify(s: string) {
  const map: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
  return s.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => map[c] ?? c).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}
