import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getSession } = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession }, functions: { invoke } },
}));

import {
  adminCreateTemplate, adminDeleteTemplate, adminDuplicateTemplate, adminInstantiateTemplate,
  adminListTemplates, adminTemplateImageUrls, adminUpdateTemplate,
} from "./api/templates";

const id = "00000000-0000-4000-8000-000000000002";
const pageId = "00000000-0000-4000-8000-000000000003";

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "admin-token" } }, error: null });
});

describe("templates SPA contract", () => {
  it("routes all seven template actions through tnb-templates with the authenticated bearer token", async () => {
    await Promise.all([
      adminListTemplates(),
      adminCreateTemplate({ data: { name: "Szablon", description: "", category: "Strona", pageId, scope: "sections", sections: [] } }),
      adminUpdateTemplate({ data: { id, name: "Szablon", description: "", category: "Strona" } }),
      adminDuplicateTemplate({ data: { id, name: "Kopia" } }),
      adminDeleteTemplate({ data: { id } }),
      adminInstantiateTemplate({ data: { id, pageId } }),
      adminTemplateImageUrls({ data: { files: [{ t: id, n: "cover-image.webp" }] } }),
    ]);
    expect(invoke).toHaveBeenCalledTimes(7);
    for (const action of [
      "adminListTemplates", "adminCreateTemplate", "adminUpdateTemplate", "adminDuplicateTemplate",
      "adminDeleteTemplate", "adminInstantiateTemplate", "adminTemplateImageUrls",
    ]) {
      expect(invoke).toHaveBeenCalledWith("tnb-templates", {
        body: expect.objectContaining({ action }),
        headers: { Authorization: "Bearer admin-token" },
      });
    }
    expect(invoke).toHaveBeenCalledWith("tnb-templates", { body: { action: "adminListTemplates" }, headers: { Authorization: "Bearer admin-token" } });
  });

  it("does not call the Edge Function when the session is missing or cannot be read", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(adminListTemplates()).rejects.toThrow("Sesja wygasła");
    getSession.mockResolvedValueOnce({ data: { session: null }, error: new Error("session unavailable") });
    await expect(adminListTemplates()).rejects.toThrow("Nie udało się odczytać sesji");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("preserves structured authorization errors and rejects empty Edge responses", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Brak uprawnień administratora." }), { status: 403 }) },
    });
    await expect(adminListTemplates()).rejects.toThrow("Brak uprawnień administratora.");
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(adminListTemplates()).rejects.toThrow("pustą odpowiedź");
  });

  it("keeps Edge action schemas, dispatch and admin checks while removing the Start handler", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-templates/index.ts", import.meta.url), "utf8");
    const sharedSchema = readFileSync(new URL("./page-section-schema.ts", import.meta.url), "utf8");
    const actions = [
      "adminListTemplates", "adminCreateTemplate", "adminUpdateTemplate", "adminDuplicateTemplate",
      "adminDeleteTemplate", "adminInstantiateTemplate", "adminTemplateImageUrls",
    ];
    for (const action of actions) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain('case "' + action + '":');
    }
    expect(edge).toContain("requireAdmin(ctx)");
    expect(edge).toContain('header.slice(7).trim()');
    expect(edge).toContain("RequestSchema.safeParse(raw)");
    expect(existsSync(new URL("./templates.functions.ts", import.meta.url))).toBe(false);
    expect(sharedSchema).toContain("DraftSectionSchema");
  });
});
