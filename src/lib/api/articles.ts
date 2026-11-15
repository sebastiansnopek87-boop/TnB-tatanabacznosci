import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ArticleListItem = Pick<
  Tables<"articles">,
  | "id"
  | "slug"
  | "title"
  | "category"
  | "status"
  | "published_at"
  | "featured"
  | "home_order"
  | "updated_at"
  | "deleted_at"
>;

type ArticleCommentItem = {
  id: string;
  author_name: string;
  body: string;
  status: string;
  created_at: string;
  article: { title: string; slug: string } | null;
  guest: boolean;
  reports: string[];
};

type ArticleInteractions = {
  poll: { question: string; options: string[]; active: boolean } | null;
  stats: {
    reactions: Record<string, number>;
    poll: Record<string, number>;
    comments: number;
  };
};

type ArticleUpload = { path: string; token: string; name: string };

type ArticleAction = string;

async function invokeArticles<T>(action: ArticleAction, data?: object): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error("Nie udało się odczytać sesji. Zaloguj się ponownie.");
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  const body = data ? { action, data } : { action };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-articles", {
    body,
    headers: { Authorization: "Bearer " + accessToken },
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as
        | { message?: unknown }
        | null;
      if (typeof payload?.message === "string" && payload.message.trim()) {
        throw new Error(payload.message);
      }
    }
    throw new Error(error.message || "Nie udało się wykonać operacji na artykułach.");
  }

  if (result === null) {
    throw new Error("Usługa artykułów zwróciła pustą odpowiedź.");
  }
  return result;
}

export function adminListArticles(): Promise<{
  items: ArticleListItem[];
  homeMode: "latest" | "featured";
}> {
  return invokeArticles("adminListArticles");
}

export async function adminTrashArticle({
  data,
}: {
  data: { id: string; action: "trash" | "restore" | "purge" };
}): Promise<{ ok: true }> {
  return invokeArticles("adminTrashArticle", data);
}

// Admin reads use the user's JWT and the existing admin-only articles RLS policy.
async function requireArticleAdmin() {
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (roleError || !isAdmin) {
    throw new Error("Brak uprawnień administratora.");
  }
}

export async function adminGetArticle({
  data,
}: {
  data: { id: string };
}): Promise<Tables<"articles">> {
  await requireArticleAdmin();
  const { data: article, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", data.id)
    .maybeSingle();

  if (error || !article) throw new Error("Nie znaleziono artykułu.");
  return article;
}

export async function adminCheckArticleSlug({
  data,
}: {
  data: { slug: string; id: string | null };
}): Promise<{ ok: boolean; reason: string }> {
  await requireArticleAdmin();
  if (!/^[a-z0-9-]{1,120}$/.test(data.slug)) {
    return { ok: false, reason: "Tylko małe litery, cyfry i myślniki." };
  }

  const { data: article, error } = await supabase
    .from("articles")
    .select("id")
    .eq("slug", data.slug)
    .maybeSingle();

  if (error) throw new Error("Nie udało się sprawdzić adresu artykułu.");
  return article && article.id !== data.id
    ? { ok: false, reason: "Ten adres jest już zajęty." }
    : { ok: true, reason: "" };
}

export function adminSaveArticle({
  data,
}: {
  data: object;
}): Promise<{ id: string }> {
  return invokeArticles("adminSaveArticle", data);
}

export function adminSetArticleStatus({
  data,
}: {
  data: { id: string; status: "draft" | "published" | "archived" };
}): Promise<{ published_at: string | null }> {
  return invokeArticles("adminSetArticleStatus", data);
}

export function adminSetFeatured({
  data,
}: {
  data: { id: string; featured: boolean; home_order: number };
}): Promise<{ ok: true }> {
  return invokeArticles("adminSetFeatured", data);
}

export function adminSetHomeMode({
  data,
}: {
  data: { mode: "latest" | "featured" };
}): Promise<{ ok: true }> {
  return invokeArticles("adminSetHomeMode", data);
}

export function adminSaveCategory({
  data,
}: {
  data: { original: string | null; slug: string; name: string; sort_order: number };
}): Promise<{ ok: true }> {
  return invokeArticles("adminSaveCategory", data);
}

export function adminDeleteCategory({
  data,
}: {
  data: { slug: string };
}): Promise<{ ok: true }> {
  return invokeArticles("adminDeleteCategory", data);
}

export function adminCreateArticleUpload({
  data,
}: {
  data: { id: string; type: string; size: number };
}): Promise<ArticleUpload> {
  return invokeArticles("adminCreateArticleUpload", data);
}

export function adminArticleImageUrls({
  data,
}: {
  data: { id: string; names: string[] };
}): Promise<Record<string, string>> {
  return invokeArticles("adminArticleImageUrls", data);
}

export function adminArticleInteractions({
  data,
}: {
  data: { id: string };
}): Promise<ArticleInteractions> {
  return invokeArticles("adminArticleInteractions", data);
}

export function adminSavePoll({
  data,
}: {
  data: object;
}): Promise<{ ok: true }> {
  return invokeArticles("adminSavePoll", data);
}

export function adminDeletePoll({
  data,
}: {
  data: { id: string };
}): Promise<{ ok: true }> {
  return invokeArticles("adminDeletePoll", data);
}

export function adminListArticleComments({
  data,
}: {
  data: { filter: "all" | "reported" | "hidden" | "pending" };
}): Promise<ArticleCommentItem[]> {
  return invokeArticles("adminListArticleComments", data);
}

export function adminModerateArticleComment({
  data,
}: {
  data: { id: string; action: "hide" | "show" | "delete" | "dismiss" | "reject" };
}): Promise<{ ok: true }> {
  return invokeArticles("adminModerateArticleComment", data);
}
