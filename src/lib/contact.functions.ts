import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Podaj imię").max(100, "Maksymalnie 100 znaków"),
  email: z.string().trim().email("Podaj poprawny adres e-mail").max(255, "Maksymalnie 255 znaków"),
  subject: z.string().trim().min(1, "Podaj temat").max(150, "Maksymalnie 150 znaków"),
  message: z.string().trim().min(10, "Wiadomość musi mieć co najmniej 10 znaków").max(3000, "Maksymalnie 3000 znaków"),
  privacy: z.boolean().refine((v) => v === true, "Potwierdź zapoznanie się z polityką prywatności"),
});

const inputSchema = contactSchema.extend({
  website: z.string().max(0).optional().default(""), // honeypot
  elapsedMs: z.number().int().nonnegative(),
});

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    // Anti-spam: honeypot filled or form sent faster than a human could.
    if (data.website || data.elapsedMs < 2500) {
      throw new Error("Wiadomość odrzucona przez filtr antyspamowy.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      privacy_accepted: true,
    });
    if (error) {
      console.error("contact insert failed", error.message);
      throw new Error("Nie udało się zapisać wiadomości.");
    }
    return { ok: true as const };
  });
