import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public: readers describe what they need; returns matching published Library items.
export const recommendLibrary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ need: z.string().trim().min(10, "Opisz potrzebę w co najmniej 10 znakach.").max(600) }).parse(d))
  .handler(async ({ data }) => {
    const { recommendMaterials, AiError } = await import("./ai/recommend.server");
    try {
      return { ok: true as const, items: await recommendMaterials(data.need) };
    } catch (e) {
      return { ok: false as const, error: e instanceof AiError ? e.message : "Nie udało się dobrać materiałów. Spróbuj ponownie." };
    }
  });
