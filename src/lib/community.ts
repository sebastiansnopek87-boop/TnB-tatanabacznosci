// Community data access through the browser client. Every write is enforced by
// RLS + database triggers (author identity, ownership, status) — not by the UI.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const POST_MAX = 5000;
export const COMMENT_MAX = 2000;
export const PAGE = 10;

export type Post = {
  id: string; author_id: string; author_name: string; body: string; status: string;
  created_at: string; updated_at: string; comments: number; reactions: number; reacted: boolean;
  visibility: Visibility; guest: boolean;
};
export type Visibility = "public" | "community";
export const VIS_LABEL: Record<Visibility, string> = { public: "Publiczny", community: "Tylko dla społeczności" };
export type Comment = { id: string; post_id: string; author_id: string; author_name: string; body: string; created_at: string; updated_at: string };

const SELECT = "id, author_id, author_name, body, status, visibility, created_at, updated_at, community_comments(count), community_reactions(count)";

// Anonymous visitors may only read these columns of public, published posts (RLS + column grants).
const PUBLIC_SELECT = "id, author_name, body, status, visibility, created_at, updated_at";
const guestRow = (r: any): Post => ({ ...r, author_id: "", comments: 0, reactions: 0, reacted: false, guest: true });

export function useUid() {
  const q = useQuery({ queryKey: ["uid"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  return { uid: q.data ?? null, ready: q.isFetched };
}

async function me() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  return data.user.id;
}

async function decorate(rows: any[]): Promise<Post[]> {
  const uid = await me();
  const ids = rows.map((r) => r.id);
  const mine = ids.length
    ? (await supabase.from("community_reactions").select("post_id").eq("user_id", uid).in("post_id", ids)).data ?? []
    : [];
  const set = new Set(mine.map((r) => r.post_id));
  return rows.map((r) => ({
    id: r.id, author_id: r.author_id, author_name: r.author_name, body: r.body, status: r.status, visibility: r.visibility, guest: false,
    created_at: r.created_at, updated_at: r.updated_at,
    comments: r.community_comments?.[0]?.count ?? 0, reactions: r.community_reactions?.[0]?.count ?? 0,
    reacted: set.has(r.id),
  }));
}

export async function listPosts(page: number, onlyMine: boolean, signedIn = true): Promise<Post[]> {
  if (!signedIn) {
    const { data, error } = await supabase.from("community_posts").select(PUBLIC_SELECT).eq("status", "published").eq("visibility", "public")
      .order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error("Nie udało się pobrać postów.");
    return (data ?? []).map(guestRow);
  }
  let q = supabase.from("community_posts").select(SELECT).order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  q = onlyMine ? q.eq("author_id", await me()) : q.eq("status", "published");
  const { data, error } = await q;
  if (error) throw new Error("Nie udało się pobrać postów.");
  return decorate(data ?? []);
}

export async function getPost(id: string, signedIn = true): Promise<Post | null> {
  if (!signedIn) {
    const { data, error } = await supabase.from("community_posts").select(PUBLIC_SELECT).eq("id", id).maybeSingle();
    if (error) throw new Error("Nie udało się pobrać posta.");
    return data ? guestRow(data) : null;
  }
  const { data, error } = await supabase.from("community_posts").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error("Nie udało się pobrać posta.");
  return data ? (await decorate([data]))[0] ?? null : null;
}

export async function listComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase.from("community_comments").select("*").eq("post_id", postId).order("created_at");
  if (error) throw new Error("Nie udało się pobrać komentarzy.");
  return data ?? [];
}

function check(body: string, max: number) {
  const t = body.trim();
  if (!t) throw new Error("Treść nie może być pusta.");
  if (t.length > max) throw new Error(`Treść może mieć najwyżej ${max} znaków.`);
  return t;
}

// Returns an error if RLS silently matched no row (e.g. someone else's content).
function one(res: { error: unknown; data: unknown[] | null }, fail: string) {
  if (res.error || !res.data?.length) throw new Error(fail);
}

export async function createPost(body: string, visibility: Visibility = "community") {
  const { error } = await supabase.from("community_posts").insert({ body: check(body, POST_MAX), visibility });
  if (error) throw new Error("Nie udało się opublikować posta.");
}
export async function updatePost(id: string, body: string, visibility: Visibility) {
  one(await supabase.from("community_posts").update({ body: check(body, POST_MAX), visibility }).eq("id", id).select("id"), "Nie udało się zapisać zmian.");
}
export async function deletePost(id: string) {
  one(await supabase.from("community_posts").delete().eq("id", id).select("id"), "Nie udało się usunąć posta.");
}
export async function createComment(postId: string, body: string) {
  const { error } = await supabase.from("community_comments").insert({ post_id: postId, body: check(body, COMMENT_MAX) });
  if (error) throw new Error("Nie udało się dodać komentarza.");
}
export async function updateComment(id: string, body: string) {
  one(await supabase.from("community_comments").update({ body: check(body, COMMENT_MAX) }).eq("id", id).select("id"), "Nie udało się zapisać komentarza.");
}
export async function deleteComment(id: string) {
  one(await supabase.from("community_comments").delete().eq("id", id).select("id"), "Nie udało się usunąć komentarza.");
}
export async function toggleReaction(postId: string, on: boolean) {
  const uid = await me();
  const { error } = on
    ? await supabase.from("community_reactions").insert({ post_id: postId })
    : await supabase.from("community_reactions").delete().eq("post_id", postId).eq("user_id", uid);
  if (error && (error as { code?: string }).code !== "23505") throw new Error("Nie udało się zapisać reakcji.");
}

export const fmtWhen = (s: string) =>
  new Date(s).toLocaleString("pl-PL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
