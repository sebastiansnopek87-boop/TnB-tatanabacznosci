import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Podaj imię").max(100, "Maksymalnie 100 znaków"),
  email: z.string().trim().email("Podaj poprawny adres e-mail").max(255, "Maksymalnie 255 znaków"),
  subject: z.string().trim().min(1, "Podaj temat").max(150, "Maksymalnie 150 znaków"),
  message: z.string().trim().min(10, "Wiadomość musi mieć co najmniej 10 znaków").max(3000, "Maksymalnie 3000 znaków"),
  privacy: z.boolean().refine((value) => value, "Potwierdź zapoznanie się z polityką prywatności"),
});

const submitContactSchema = contactSchema.extend({
  website: z.string().max(0).optional().default(""),
  elapsedMs: z.number().int().nonnegative(),
});

type SubmitContactInput = z.infer<typeof submitContactSchema>;

export async function submitContact({ data }: { data: SubmitContactInput }): Promise<{ ok: true }> {
  const { data: result, error } = await supabase.functions.invoke<{ ok: true }>("tnb-contact", { body: data });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as { message?: unknown } | null;
      if (typeof payload?.message === "string" && payload.message.trim()) {
        throw new Error(payload.message);
      }
    }
    throw new Error(error.message || "Nie udało się wysłać wiadomości.");
  }
  if (!result?.ok) throw new Error("Usługa kontaktowa zwróciła nieprawidłową odpowiedź.");
  return result;
}
