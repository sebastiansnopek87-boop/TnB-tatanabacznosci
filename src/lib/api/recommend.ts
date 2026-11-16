import { supabase } from "@/integrations/supabase/client";

export type LibraryRecommendation = { slug: string; title: string; reason: string };
export type LibraryRecommendationResult =
  | { ok: true; items: LibraryRecommendation[] }
  | { ok: false; error: string };

export async function recommendLibrary({ data }: { data: { need: string } }): Promise<LibraryRecommendationResult> {
  const { data: result, error } = await supabase.functions.invoke<LibraryRecommendationResult>("tnb-recommend", {
    body: { action: "recommendLibrary", data },
  });
  if (error) throw new Error(error.message || "Nie udało się dobrać materiałów. Spróbuj ponownie.");
  if (!result) throw new Error("Usługa rekomendacji zwróciła pustą odpowiedź.");
  return result;
}
