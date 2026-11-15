import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const GUEST_COMMENT_RULES = "Akceptuję zasady komentowania: piszę z szacunkiem, bez ataków personalnych i danych wrażliwych. Moderator może ukryć komentarz naruszający zasady.";

const guestInput = z.object({
  articleId: z.string().uuid(),
  firstName: z.string().trim().min(1, "Podaj imię.").max(60).regex(/^[\p{L}][\p{L}\s'.-]*$/u, "Imię zawiera niedozwolone znaki."),
  lastName: z.string().trim().min(1, "Podaj nazwisko.").max(80).regex(/^[\p{L}][\p{L}\s'.-]*$/u, "Nazwisko zawiera niedozwolone znaki."),
  email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
  body: z.string().trim().min(2, "Komentarz jest za krótki.").max(2000, "Komentarz jest za długi."),
  rules: z.literal(true, { errorMap: () => ({ message: "Zaakceptuj zasady komentowania." }) }),
  website: z.string().max(0).optional().default(""),
  elapsedMs: z.number().int().nonnegative(),
});
export type GuestCommentInput = z.infer<typeof guestInput>;
export type GuestCommentConfirmation = {
  status: "published" | "invalid" | "used" | "expired" | "blocked";
  slug?: string;
  canResend?: boolean;
};

type ApiError = { message?: unknown };
async function invokeGuestComments<T>(action: string, data: Record<string, unknown>): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-guest-comments", { body: { action, data } });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą komentarzy.");
  }
  if (result === null) throw new Error("Usługa komentarzy zwróciła pustą odpowiedź.");
  return result as T;
}

export function submitGuestComment({ data }: { data: GuestCommentInput }): Promise<{ status: "check_email" }> {
  return invokeGuestComments("submitGuestComment", data);
}
export function confirmGuestComment({ data }: { data: { token: string } }): Promise<GuestCommentConfirmation> {
  return invokeGuestComments("confirmGuestComment", data);
}
export function resendGuestComment({ data }: { data: { token: string } }): Promise<{ status: "sent_if_possible" }> {
  return invokeGuestComments("resendGuestComment", data);
}
