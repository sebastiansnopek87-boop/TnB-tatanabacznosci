import { supabase } from "@/integrations/supabase/client";

export const GUEST_COMMENT_RULES =
  "Akceptuję zasady komentowania: piszę z szacunkiem, bez ataków personalnych i danych wrażliwych. Moderator może ukryć komentarz naruszający zasady.";

type GuestCommentInput = {
  articleId: string;
  firstName: string;
  lastName: string;
  email: string;
  body: string;
  rules: true;
  website?: string;
  elapsedMs: number;
};

export type ConfirmGuestCommentResult = {
  status: "published" | "invalid" | "used" | "expired" | "blocked";
  slug?: string;
  canResend?: boolean;
};

type ApiError = { message?: unknown };

async function invokeGuestComments<T>(
  action: "submitGuestComment" | "confirmGuestComment" | "resendGuestComment",
  data: Record<string, unknown>,
): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-guest-comments", {
    body: { action, data },
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) {
        throw new Error(payload.message);
      }
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą komentarzy.");
  }
  if (result === null) throw new Error("Usługa komentarzy zwróciła pustą odpowiedź.");
  return result as T;
}

export function submitGuestComment({ data }: { data: GuestCommentInput }): Promise<{ status: "check_email" }> {
  return invokeGuestComments("submitGuestComment", data);
}

export function confirmGuestComment({ data }: { data: { token: string } }): Promise<ConfirmGuestCommentResult> {
  return invokeGuestComments("confirmGuestComment", data);
}

export function resendGuestComment({ data }: { data: { token: string } }): Promise<{ status: "sent_if_possible" }> {
  return invokeGuestComments("resendGuestComment", data);
}
