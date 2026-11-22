import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const NEWSLETTER_CONSENT_VERSION = "2026-09-28";
export const NEWSLETTER_CONSENT_TEXT =
  "Wyrażam zgodę na otrzymywanie newslettera Tata Na Baczności na podany adres e-mail. Zgodę mogę wycofać w każdej chwili.";

export const newsletterSchema = z.object({
  first_name: z.string().trim().max(100, "Imię jest za długie").optional(),
  email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail").max(255, "Adres jest za długi"),
  consent: z.boolean().refine((value) => value, "Zaznacz zgodę na otrzymywanie newslettera"),
});

export type SubscribeResult = {
  status: "subscribed" | "already" | "resubscribed" | "pending";
};

type UnsubscribeInput =
  | { token: string }
  | { email: string; website?: string };

type ApiError = { message?: unknown };

async function invokeNewsletter<T>(
  action: "subscribe" | "unsubscribe" | "confirm",
  data: Record<string, unknown>,
): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-newsletter", {
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
    throw new Error(error.message || "Nie udało się połączyć z usługą newslettera.");
  }
  if (result === null) throw new Error("Usługa newslettera zwróciła pustą odpowiedź.");
  return result as T;
}

export function subscribeNewsletter({
  data,
}: {
  data: z.input<typeof newsletterSchema> & {
    website?: string;
    elapsedMs: number;
  };
}): Promise<SubscribeResult> {
  return invokeNewsletter<SubscribeResult>("subscribe", data);
}

export function unsubscribeNewsletter({
  data,
}: {
  data: UnsubscribeInput;
}): Promise<{ ok: true }> {
  return invokeNewsletter<{ ok: true }>("unsubscribe", data);
}

export function confirmNewsletter({ data }: { data: { token: string } }): Promise<{ ok: true }> {
  return invokeNewsletter<{ ok: true }>("confirm", data);
}
