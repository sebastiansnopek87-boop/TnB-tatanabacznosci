import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getSession } = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession }, functions: { invoke } },
}));

import {
  adminAttachFile, adminCreateUpload, adminGetEpisode, adminListEpisodes, adminPreviewAudio,
  adminRemoveFile, adminSaveEpisode, adminSetEpisodeStatus, getEpisode, getEpisodeMedia, listEpisodes,
} from "./api/podcast";

const id = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "admin-token" } }, error: null });
});

describe("podcast SPA contract", () => {
  it("routes all eleven public and admin actions through tnb-podcast", async () => {
    const episode = {
      id: null, slug: "odcinek-testowy", title: "Odcinek testowy", subtitle: "", episode_number: 1,
      summary: "Opis", description: "Opis dłuższy", script: "", category: "rozmowy",
      access: "public" as const, external_url: "", duration_seconds: 60, featured: false,
      sort_order: 1, published_at: null,
    };
    await Promise.all([
      listEpisodes(),
      getEpisode({ data: { slug: "odcinek-testowy" } }),
      getEpisodeMedia({ data: { id } }),
      adminListEpisodes(),
      adminGetEpisode({ data: { id } }),
      adminSaveEpisode({ data: episode }),
      adminSetEpisodeStatus({ data: { id, status: "published" } }),
      adminCreateUpload({ data: { id, kind: "audio", type: "audio/mpeg", size: 1024 } }),
      adminAttachFile({ data: { id, kind: "audio", path: "2026/11/episode.mp3", type: "audio/mpeg" } }),
      adminRemoveFile({ data: { id, kind: "cover" } }),
      adminPreviewAudio({ data: { id } }),
    ]);
    const actions = [
      "listEpisodes", "getEpisode", "getEpisodeMedia", "adminListEpisodes", "adminGetEpisode",
      "adminSaveEpisode", "adminSetEpisodeStatus", "adminCreateUpload", "adminAttachFile",
      "adminRemoveFile", "adminPreviewAudio",
    ];
    expect(invoke).toHaveBeenCalledTimes(actions.length);
    for (const action of actions) {
      expect(invoke).toHaveBeenCalledWith("tnb-podcast", {
        body: expect.objectContaining({ action }),
        headers: { Authorization: "Bearer admin-token" },
      });
    }
  });

  it("allows anonymous public reads but blocks admin calls without a session", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(listEpisodes()).resolves.toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith("tnb-podcast", { body: { action: "listEpisodes" }, headers: {} });

    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(adminListEpisodes()).rejects.toThrow("Sesja wygasła");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("preserves Edge errors and allows null only for the optional episode detail", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(getEpisode({ data: { slug: "brak" } })).resolves.toBeNull();
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Brak uprawnień administratora." }), { status: 403 }) },
    });
    await expect(adminListEpisodes()).rejects.toThrow("Brak uprawnień administratora.");
  });

  it("keeps public/admin action boundaries and access-controlled audio behavior explicit", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-podcast/index.ts", import.meta.url), "utf8");
    const legacy = readFileSync(new URL("./podcast.functions.ts", import.meta.url), "utf8");
    const actions = [
      "listEpisodes", "getEpisode", "getEpisodeMedia", "adminListEpisodes", "adminGetEpisode",
      "adminSaveEpisode", "adminSetEpisodeStatus", "adminCreateUpload", "adminAttachFile",
      "adminRemoveFile", "adminPreviewAudio",
    ];
    for (const action of actions) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain('case "' + action + '"');
      expect(legacy).toContain("export const " + action + " =");
    }
    expect(edge).toContain("const protectedActions = new Set");
    expect(edge).toContain("if (protectedActions.has(input.action)) user = await requireAdmin(db, req)");
    expect(edge).toContain("getEpisodeMedia(db, req, input.data.id)");
    expect(edge).toContain('_role: "premium"');
    expect(edge).toContain('_role: "admin"');
    expect(edge).toContain("createSignedUrl");
  });
});
