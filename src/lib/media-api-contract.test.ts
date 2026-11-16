import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getSession } = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession }, functions: { invoke } },
}));

import {
  createMediaUpload, deleteMedia, finalizeMediaUpload, getMediaDetail, listMedia,
} from "./api/media";

const target = { bucket: "media" as const, path: "2026/11/example-abc123.jpg" };

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "admin-token" } }, error: null });
});

describe("media SPA contract", () => {
  it("routes all five actions through tnb-media-admin with the bearer token", async () => {
    await Promise.all([
      listMedia({ data: { q: "logo", kind: "image", module: "pages", sort: "date_desc", page: 0 } }),
      getMediaDetail({ data: target }),
      createMediaUpload({ data: { name: "logo.jpg", type: "image/jpeg", size: 1024 } }),
      finalizeMediaUpload({ data: { path: target.path } }),
      deleteMedia({ data: target }),
    ]);
    const actions = ["listMedia", "getMediaDetail", "createMediaUpload", "finalizeMediaUpload", "deleteMedia"];
    expect(invoke).toHaveBeenCalledTimes(actions.length);
    for (const action of actions) {
      expect(invoke).toHaveBeenCalledWith("tnb-media-admin", {
        body: expect.objectContaining({ action, data: expect.any(Object) }),
        headers: { Authorization: "Bearer admin-token" },
      });
    }
  });

  it("blocks operations without a session and propagates Edge authorization failures", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(listMedia({ data: { q: "", kind: "", module: "", sort: "date_desc", page: 0 } }))
      .rejects.toThrow("Sesja wygasła");
    expect(invoke).not.toHaveBeenCalled();

    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Brak uprawnień administratora." }), { status: 403 }) },
    });
    await expect(deleteMedia({ data: target })).rejects.toThrow("Brak uprawnień administratora.");
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(getMediaDetail({ data: target })).rejects.toThrow("pustą odpowiedź");
  });

  it("keeps the Edge action schema, admin gate, upload verification and fail-closed deletion", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-media-admin/index.ts", import.meta.url), "utf8");
    const legacy = readFileSync(new URL("./media.functions.ts", import.meta.url), "utf8");
    const actions = ["listMedia", "getMediaDetail", "createMediaUpload", "finalizeMediaUpload", "deleteMedia"];
    for (const action of actions) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(legacy).toContain("export const " + action + " =");
    }
    expect(edge).toContain("await requireAdmin(ctx)");
    expect(edge).toContain("!ALLOWED_ORIGINS.has(origin)");
    expect(edge).toContain("MAX_BODY_BYTES");
    expect(edge).toContain("data.size > MAX_UPLOAD");
    expect(edge).toContain("Number(object.size) <= MAX_UPLOAD");
    expect(edge).toContain("ALLOWED[object.mimetype]");
    expect(edge).toContain("usage = await buildUsage(ctx)");
    expect(edge).toContain("if (used.length)");
    expect(edge).toContain("media_usage_unavailable");
    expect(edge).toContain("Plik jest używany");
  });
});
