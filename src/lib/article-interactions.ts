// Reader interactions under editorial articles (comments, reactions, polls, saved collection).
// Browser client only; every write is enforced by RLS + database triggers (0032_article_interactions.sql).
import { supabase } from "@/integrations/supabase/client";
import type { ArticleCard } from "./articles";

export const ARTICLE_COMMENT_MAX = 2000;
export const REACTIONS = { moved: "Poruszyło mnie", thought: "Daje do myślenia", agree: "Zgadzam się", different: "Mam inne spojrzenie" } as const;
export type ReactionType = keyof typeof REACTIONS;
export type ArticleComment = { id: string; author_id: string; author_name: string; body: string; status: string; created_at: string; updated_at: string };
export type Poll = { question: string; options: string[]; active: boolean };
export type Stats = { reactions: Record<string, number>; poll: Record<number, number>; comments: number };

export function interactionError(e: any): string {
  const m = String(e?.message ?? "");
  if (m.includes("display_name_missing")) return "Uzupełnij nick albo imię i nazwisko w „Moje TNB”, aby komentować.";
  if (m.includes("comment_too_fast")) return "Odczekaj chwilę przed dodaniem kolejnego komentarza.";
  if (m.includes("comment_duplicate")) return "Ten komentarz został już dodany.";
  if (m.includes("row-level security") || e?.code === "42501") return "Nie masz uprawnień do tej operacji albo artykuł nie jest dostępny.";
  return "Coś poszło nie tak. Spróbuj ponownie.";
}

export async function getStats(articleId: string): Promise<Stats> {
  const { data, error } = await supabase.rpc("article_stats", { _article: articleId });
  if (error) throw new Error("Nie udało się pobrać statystyk.");
  const s: Stats = { reactions: {}, poll: {}, comments: 0 };
  for (const r of (data ?? []) as any[]) {
    if (r.kind === "reaction") s.reactions[r.key] = Number(r.n);
    else if (r.kind === "poll") s.poll[Number(r.key)] = Number(r.n);
    else s.comments = Number(r.n);
  }
  return s;
}

export async function getPoll(articleId: string): Promise<Poll | null> {
  const { data } = await supabase.from("article_polls").select("question, options, active").eq("article_id", articleId).maybeSingle();
  return data ? { question: data.question, options: (data.options as string[]) ?? [], active: data.active } : null;
}

export async function myState(articleId: string, uid: string) {
  const [r, v, s] = await Promise.all([
    supabase.from("article_reactions").select("type").eq("article_id", articleId).eq("user_id", uid).maybeSingle(),
    supabase.from("article_poll_votes").select("option_index").eq("article_id", articleId).eq("user_id", uid).maybeSingle(),
    supabase.from("article_saves").select("article_id").eq("article_id", articleId).eq("user_id", uid).maybeSingle(),
  ]);
  return { reaction: (r.data?.type ?? null) as ReactionType | null, vote: v.data?.option_index ?? null, saved: !!s.data };
}

export async function setReaction(articleId: string, uid: string, type: ReactionType | null) {
  const { error } = type
    ? await supabase.from("article_reactions").upsert({ article_id: articleId, user_id: uid, type }, { onConflict: "article_id,user_id" })
    : await supabase.from("article_reactions").delete().eq("article_id", articleId).eq("user_id", uid);
  if (error) throw error;
}

export async function vote(articleId: string, uid: string, option: number) {
  const { error } = await supabase.from("article_poll_votes").upsert({ article_id: articleId, user_id: uid, option_index: option }, { onConflict: "article_id,user_id" });
  if (error) throw error;
}

export async function setSaved(articleId: string, uid: string, saved: boolean) {
  const { error } = saved
    ? await supabase.from("article_saves").upsert({ article_id: articleId, user_id: uid }, { onConflict: "user_id,article_id", ignoreDuplicates: true })
    : await supabase.from("article_saves").delete().eq("article_id", articleId).eq("user_id", uid);
  if (error) throw error;
}

export async function listArticleComments(articleId: string, signedIn: boolean): Promise<ArticleComment[]> {
  const cols = "id, author_name, body, status, created_at, updated_at" + (signedIn ? ", author_id" : "");
  const { data, error } = await supabase.from("article_comments").select(cols).eq("article_id", articleId).order("created_at");
  if (error) throw new Error("Nie udało się pobrać komentarzy.");
  return ((data ?? []) as any[]).map((c) => ({ author_id: "", ...c }));
}

export async function addComment(articleId: string, body: string) {
  const { error } = await supabase.from("article_comments").insert({ article_id: articleId, body: body.trim() } as any);
  if (error) throw error;
}
export async function editComment(id: string, body: string) {
  const { error } = await supabase.from("article_comments").update({ body: body.trim() }).eq("id", id);
  if (error) throw error;
}
export async function deleteComment(id: string) {
  const { error } = await supabase.from("article_comments").delete().eq("id", id);
  if (error) throw error;
}
export async function reportComment(id: string, reason: string) {
  const { error } = await supabase.from("article_comment_reports").insert({ comment_id: id, reason: reason.slice(0, 500) } as any);
  if (error && error.code !== "23505") throw error;
}

export type SavedItem = { article_id: string; created_at: string; article: ArticleCard | null };
export async function listMySaved(uid: string): Promise<SavedItem[]> {
  const { data, error } = await supabase.from("article_saves").select("article_id, created_at").eq("user_id", uid).order("created_at", { ascending: false });
  if (error) throw new Error("Nie udało się pobrać kolekcji.");
  const ids = (data ?? []).map((r) => r.article_id);
  // RLS returns only articles that are still public; the rest are shown as unavailable.
  const { data: arts } = ids.length
    ? await supabase.from("articles").select("id, slug, title, excerpt, category, cover, cover_alt, author_name, reading_minutes, published_at, updated_at").in("id", ids)
    : { data: [] as any[] };
  const map = new Map((arts ?? []).map((a: any) => [a.id, a as ArticleCard]));
  return (data ?? []).map((r) => ({ ...r, article: map.get(r.article_id) ?? null }));
}

export async function relatedArticles(id: string, category: string | null): Promise<ArticleCard[]> {
  const CARD = "id, slug, title, excerpt, category, cover, cover_alt, author_name, reading_minutes, published_at, updated_at";
  const same = category ? (await supabase.from("articles").select(CARD).eq("category", category).neq("id", id).order("published_at", { ascending: false }).limit(3)).data ?? [] : [];
  if (same.length >= 3) return same as ArticleCard[];
  const rest = (await supabase.from("articles").select(CARD).neq("id", id).order("published_at", { ascending: false }).limit(6)).data ?? [];
  const seen = new Set(same.map((a: any) => a.id));
  return [...same, ...rest.filter((a: any) => !seen.has(a.id))].slice(0, 3) as ArticleCard[];
}
