import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const articleNewsletterContentSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  preheader: z.string().trim().min(1).max(200),
  intro: z.string().trim().min(1).max(600),
  teaser: z.string().trim().min(1).max(1500),
  outro: z.string().trim().min(1).max(600),
});
export type ArticleNewsletterContent = z.infer<typeof articleNewsletterContentSchema>;
export type ArticleNewsletterRecord = ArticleNewsletterContent & {
  article_id: string;
  status: string;
  mode: string | null;
  round: number | null;
  recipients: number | null;
  sent_count: number | null;
  simulated_count: number | null;
  failed_count: number | null;
  last_note: string | null;
  updated_at: string;
};
export type ArticleNewsletterOrigin = {
  material_id?: string | null;
  version_n?: number | null;
  handed_off_at?: string | null;
  tags?: string[];
  cta?: string | null;
  sources?: Array<{ title: string }>;
};
export type ArticleNewsletterOverview = {
  published: boolean;
  newsletter: ArticleNewsletterRecord | null;
  activeSubscribers: number;
  mode: "test" | "live";
  origin: ArticleNewsletterOrigin | null;
  testEmail: string | null;
};
export type ArticleNewsletterDispatchResult = {
  status: "sent" | "simulated" | "skipped" | "failed" | "duplicate";
  to?: string;
  reason?: string | null;
};
type ApiError = { message?: unknown };

async function invokeArticleNewsletter<T>(action: string, data: Record<string, unknown>): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-article-newsletter", { body: { action, data } });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą newslettera artykułów.");
  }
  if (result === null) throw new Error("Usługa newslettera artykułów zwróciła pustą odpowiedź.");
  return result as T;
}

type IdInput = { articleId: string };
export function getArticleNewsletter({ data }: { data: IdInput }): Promise<ArticleNewsletterOverview> {
  return invokeArticleNewsletter("getArticleNewsletter", data);
}
export function prepareArticleNewsletter({ data }: { data: IdInput & { useAi: boolean } }): Promise<{ ok: true }> {
  return invokeArticleNewsletter("prepareArticleNewsletter", data);
}
export function saveArticleNewsletter({ data }: { data: IdInput & ArticleNewsletterContent }): Promise<{ ok: true }> {
  const parsed = articleNewsletterContentSchema.parse(data);
  return invokeArticleNewsletter("saveArticleNewsletter", { ...data, ...parsed });
}
export function unmarkArticleNewsletter({ data }: { data: IdInput }): Promise<{ ok: true }> {
  return invokeArticleNewsletter("unmarkArticleNewsletter", data);
}
export function sendArticleNewsletterTest({ data }: { data: IdInput }): Promise<ArticleNewsletterDispatchResult> {
  return invokeArticleNewsletter("sendArticleNewsletterTest", data);
}
export function sendArticleNewsletter({ data }: { data: IdInput & { expectedRecipients: number; confirmed: true } }): Promise<{
  status: "approved" | "failed";
  mode: "test";
  sent: number;
  simulated: number;
  failed: number;
  note: string;
}> {
  return invokeArticleNewsletter("sendArticleNewsletter", data);
}
