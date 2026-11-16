import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import { recommendLibrary } from "./api/recommend";

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({
    data: { ok: true, items: [{ slug: "spokojny-dom", title: "Spokojny dom", reason: "Pasuje do opisanej potrzeby." }] },
    error: null,
  });
});

describe("library recommendation SPA contract", () => {
  it("keeps the public action and input validation aligned across legacy and Edge", () => {
    const legacy = readFileSync(new URL("./recommend.functions.ts", import.meta.url), "utf8");
    const edge = readFileSync(new URL("../../supabase/functions/tnb-recommend/index.ts", import.meta.url), "utf8");

    expect(legacy).toContain("export const recommendLibrary =");
    expect(legacy).toContain("min(10");
    expect(legacy).toContain("max(600)");
    expect(edge).toContain('action: z.literal("recommendLibrary")');
    expect(edge).toContain("min(10");
    expect(edge).toContain("max(600)");
    expect(edge).toContain('row.access === "premium" ? ""');
  });

  it("sends the established action and payload to tnb-recommend", async () => {
    const input = { need: "Szukam materiału o spokojnej komunikacji z dzieckiem." };
    await recommendLibrary({ data: input });

    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith("tnb-recommend", {
      body: { action: "recommendLibrary", data: input },
    });
  });

  it("propagates invocation errors and rejects an empty response", async () => {
    const failure = new Error("Usługa chwilowo niedostępna");
    invoke.mockResolvedValueOnce({ data: null, error: failure });
    await expect(recommendLibrary({ data: { need: "Potrzebuję pomocy w relacji." } })).rejects.toThrow(failure);

    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(recommendLibrary({ data: { need: "Potrzebuję pomocy w relacji." } })).rejects.toThrow("pustą odpowiedź");
  });
});
