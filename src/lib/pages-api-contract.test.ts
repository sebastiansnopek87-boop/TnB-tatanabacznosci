import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getSession } = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession }, functions: { invoke } },
}));

import {
  adminCheckSlug, adminCreatePageUpload, adminGetPage, adminListPages, adminListVersions,
  adminPageImageUrls, adminPublishDraft, adminRestoreVersion, adminSaveDraft, adminSavePage,
  adminSetPageStatus, adminStartHomeDraft, getPublicPage,
} from "./api/pages";

const id = "00000000-0000-4000-8000-000000000002";
const versionId = "00000000-0000-4000-8000-000000000003";
const draft = {} as never;

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "admin-token" } }, error: null });
});

describe("pages SPA contract", () => {
  it("routes public read and all twelve admin actions through tnb-pages", async () => {
    const save = {
      id, slug: "strona-testowa", title: "Strona testowa", intro: "Wprowadzenie",
      sections: [], seo_title: "SEO", seo_description: "Opis SEO",
    };
    await Promise.all([
      getPublicPage({ data: { slug: "strona-testowa" } }),
      adminListPages(),
      adminGetPage({ data: { id } }),
      adminCheckSlug({ data: { slug: "strona-testowa", id: null } }),
      adminSavePage({ data: save }),
      adminSetPageStatus({ data: { id, status: "published" } }),
      adminCreatePageUpload({ data: { id, type: "image/png", size: 1024 } }),
      adminPageImageUrls({ data: { id, names: ["cover.png"] } }),
      adminSaveDraft({ data: { id, draft, version: true } }),
      adminPublishDraft({ data: { id, legalConfirmed: true, expectedDigest: "a".repeat(64) } }),
      adminListVersions({ data: { id } }),
      adminRestoreVersion({ data: { id, versionId } }),
      adminStartHomeDraft({ data: { id, draft } }),
    ]);
    expect(invoke).toHaveBeenCalledTimes(13);
    expect(invoke).toHaveBeenCalledWith("tnb-pages", {
      body: { action: "getPublicPage", data: { slug: "strona-testowa" } },
    });
    for (const action of [
      "adminListPages", "adminGetPage", "adminCheckSlug", "adminSavePage", "adminSetPageStatus",
      "adminCreatePageUpload", "adminPageImageUrls", "adminSaveDraft", "adminPublishDraft",
      "adminListVersions", "adminRestoreVersion", "adminStartHomeDraft",
    ]) {
      expect(invoke).toHaveBeenCalledWith("tnb-pages", {
        body: expect.objectContaining({ action }),
        headers: { Authorization: "Bearer admin-token" },
      });
    }
  });

  it("keeps public reads anonymous and blocks admin actions without a session", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(getPublicPage({ data: { key: "home" } })).resolves.toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith("tnb-pages", { body: { action: "getPublicPage", data: { key: "home" } } });
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(adminListPages()).rejects.toThrow("Sesja wygasła");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("preserves Edge permission errors and validates publication safeguards", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Brak uprawnień administratora." }), { status: 403 }) },
    });
    await expect(adminPublishDraft({ data: { id, legalConfirmed: true } })).rejects.toThrow("Brak uprawnień administratora.");
    const edge = readFileSync(new URL("../../supabase/functions/tnb-pages/index.ts", import.meta.url), "utf8");
    expect(edge).toContain("expectedDigest");
    expect(edge).toContain("legalConfirmed");
    expect(edge).toContain("requireAdmin(ctx)");
    expect(edge).toContain("DraftInput");
    expect(edge).toContain("adminListVersions");
  });

  it("keeps all Edge action schemas and removes the Start handler", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-pages/index.ts", import.meta.url), "utf8");
    const actions = [
      "getPublicPage", "adminListPages", "adminGetPage", "adminCheckSlug", "adminSavePage",
      "adminSetPageStatus", "adminCreatePageUpload", "adminPageImageUrls", "adminSaveDraft",
      "adminPublishDraft", "adminListVersions", "adminRestoreVersion", "adminStartHomeDraft",
    ];
    for (const action of actions) {
      expect(edge).toContain('z.literal("' + action + '")');
      if (action === "getPublicPage") {
        expect(edge).toContain('if (parsed.data.action === "getPublicPage")');
      } else {
        expect(edge).toContain('case "' + action + '":');
      }
    }
    expect(existsSync(new URL("./pages.functions.ts", import.meta.url))).toBe(false);
  });
});
