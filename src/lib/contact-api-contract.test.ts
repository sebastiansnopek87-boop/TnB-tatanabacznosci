import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import { contactSchema, submitContact } from "./api/contact";

beforeEach(() => invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null }));

describe("contact SPA contract", () => {
  const data = {
    name: "Jan Kowalski", email: "jan@example.com", subject: "Pytanie",
    message: "To jest przykładowa wiadomość kontaktowa.", privacy: true,
    website: "", elapsedMs: 3000,
  };

  it("validates contact fields and sends the exact public Edge payload", async () => {
    expect(contactSchema.safeParse({ ...data, privacy: false }).success).toBe(false);
    expect(contactSchema.safeParse({ ...data, message: "krótko" }).success).toBe(false);
    await submitContact({ data });
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith("tnb-contact", { body: data });
  });

  it("preserves Edge validation errors and rejects malformed success responses", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Wiadomość odrzucona przez filtr antyspamowy." }), { status: 400 }) },
    });
    await expect(submitContact({ data })).rejects.toThrow("Wiadomość odrzucona przez filtr antyspamowy.");
    invoke.mockResolvedValueOnce({ data: { ok: false }, error: null });
    await expect(submitContact({ data })).rejects.toThrow("nieprawidłową odpowiedź");
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(submitContact({ data })).rejects.toThrow("nieprawidłową odpowiedź");
  });

  it("keeps strict Edge validation, origin allowlist, anti-spam and safe email rendering explicit", () => {
    expect(existsSync(new URL("./contact.functions.ts", import.meta.url))).toBe(false);
    const edge = readFileSync(new URL("../../supabase/functions/tnb-contact/index.ts", import.meta.url), "utf8");
    expect(edge).not.toContain("@tanstack/react-start");
    expect(edge).toContain("}).strict()");
    expect(edge).toContain('"https://tatanabacznosci.pl"');
    expect(edge).toContain('"https://www.tatanabacznosci.pl"');
    expect(edge).toContain("!allowedOrigins.has(origin)");
    expect(edge).toContain("data.elapsedMs < 2500");
    expect(edge).toContain("data.website");
    expect(edge).toContain("escapeHtml");
    expect(edge).toContain("privacy: z.literal(true");
  });
});
