import { supabase } from "@/integrations/supabase/client";

type Input = { data: Record<string, any> };
type ApiError = { message?: unknown };

async function invokeArticleNewsletter<T>(action: string, data: Record<string, any>): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-article-newsletter", {
    body: { action, data },
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą newslettera artykułów.");
  }
  return result as T;
}

export const getArticleNewsletter = ({ data }: Input) => invokeArticleNewsletter<any>("getArticleNewsletter", data);
export const prepareArticleNewsletter = ({ data }: Input) => invokeArticleNewsletter<{ ok: true }>("prepareArticleNewsletter", data);
export const saveArticleNewsletter = ({ data }: Input) => invokeArticleNewsletter<{ ok: true }>("saveArticleNewsletter", data);
export const unmarkArticleNewsletter = ({ data }: Input) => invokeArticleNewsletter<{ ok: true }>("unmarkArticleNewsletter", data);
export const sendArticleNewsletterTest = ({ data }: Input) => invokeArticleNewsletter<{ status: string; to: string; reason: string | null }>("sendArticleNewsletterTest", data);
export const sendArticleNewsletter = ({ data }: Input) => invokeArticleNewsletter<{ status: string; mode: string; sent: number; simulated: number; failed: number; note: string }>("sendArticleNewsletter", data);
