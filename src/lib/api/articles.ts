import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Admin reads use the user's JWT and the existing admin-only articles RLS policy.
// Writes, moderation, audit logging and storage signing remain in the server layer.
export * from "@/lib/articles.functions";

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

export async function adminGetArticle({ data }: { data: { id: string } }): Promise<Tables<"articles">> {
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
