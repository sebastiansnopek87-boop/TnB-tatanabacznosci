import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Podaj imię").max(100, "Maksymalnie 100 znaków"),
  email: z.string().trim().email("Podaj poprawny adres e-mail").max(255, "Maksymalnie 255 znaków"),
  subject: z.string().trim().min(1, "Podaj temat").max(150, "Maksymalnie 150 znaków"),
  message: z.string().trim().min(10, "Wiadomość musi mieć co najmniej 10 znaków").max(3000, "Maksymalnie 3000 znaków"),
  privacy: z.boolean().refine((v) => v === true, "Potwierdź zapoznanie się z polityką prywatności"),
});
