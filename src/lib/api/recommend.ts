import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const recommendLibrarySchema = z.object({
  need: z.string().trim().min(10, "Opisz potrzebę w co najmniej 10 znakach.").max(600),
});
export type Recommendation = { slug: string; title: string; reason: string };
export type RecommendLibraryResult = { ok: true; items: Recommendation[] } | { ok: false; error: string };
type ApiError = { error?: unknown; message?: unknown };

export async function recommendLibrary({ data }: { data: z.infer<typeof recommendLibrarySchema> }): Promise<RecommendLibraryResult> {
  const parsed = recommendLibrarySchema.parse(data);
  const { data: result, error } = await supabase.functions.invoke<RecommendLibraryResult>("tnb-recommend", {
    body: { action: "recommendLibrary", data: parsed },
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.error === "string" && payload.error.trim()) return { ok: false, error: payload.error };
      if (typeof payload?.message === "string" && payload.message.trim()) return { ok: false, error: payload.message };
    }
    return { ok: false, error: error.message || "Nie udało się dobrać materiałów. Spróbuj ponownie." };
  }
  return result ?? { ok: false, error: "Wyszukiwanie AI zwróciło pustą odpowiedź." };
}
