import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getSession } = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession }, functions: { invoke } },
}));

import {
  adminAddManualVideo, adminGetYoutubeSource, adminListVideos, adminSaveYoutubeKey,
  adminSaveYoutubeSource, adminSetVideoStatus, adminSyncIfStale, adminSyncYoutube,
  adminTestYoutubeKey, adminUpdateVideo, getPublicChannel, listVideos,
} from "./api/youtube";

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "admin-token" } }, error: null });
});

describe("YouTube SPA contract", () => {
  it("routes public reads without requiring a session", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await listVideos();
    await getPublicChannel();
    expect(invoke).toHaveBeenNthCalledWith(1, "tnb-youtube", { body: { action: "listVideos" }, headers: {} });
    expect(invoke).toHaveBeenNthCalledWith(2, "tnb-youtube", { body: { action: "getPublicChannel" }, headers: {} });
  });

  it("routes all ten admin actions through the authenticated YouTube Edge Function", async () => {
    await Promise.all([
      adminGetYoutubeSource(),
      adminSaveYoutubeKey({ data: { key: "AIza012345678901234567890123456789012" } }),
      adminTestYoutubeKey(),
      adminSaveYoutubeSource({ data: { input: "@kanaltnb" } }),
      adminSyncYoutube(),
      adminSyncIfStale(),
      adminListVideos(),
      adminSetVideoStatus({ data: { id: "00000000-0000-4000-8000-000000000001", status: "published" } }),
      adminUpdateVideo({ data: {
        id: "00000000-0000-4000-8000-000000000001", title: "Tytuł", description: "", custom_thumbnail_url: "",
        category: "", featured: false, sort_order: 0, published_on: "", reset_title: false, reset_description: false,
      } }),
      adminAddManualVideo({ data: {
        url: "https://youtu.be/abcdefghijk", title: "Tytuł", description: "", custom_thumbnail_url: "",
        category: "", published_on: "2026-11-27", status: "draft",
      } }),
    ]);
    const actions = [
      "adminGetYoutubeSource", "adminSaveYoutubeKey", "adminTestYoutubeKey", "adminSaveYoutubeSource",
      "adminSyncYoutube", "adminSyncIfStale", "adminListVideos", "adminSetVideoStatus", "adminUpdateVideo", "adminAddManualVideo",
    ];
    expect(invoke).toHaveBeenCalledTimes(actions.length);
    for (const action of actions) {
      expect(invoke).toHaveBeenCalledWith("tnb-youtube", {
        body: expect.objectContaining({ action }),
        headers: { Authorization: "Bearer admin-token" },
      });
    }
  });

  it("fails closed when an admin session is missing or unavailable", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(adminListVideos()).rejects.toThrow("Sesja wygasła");
    getSession.mockResolvedValueOnce({ data: { session: null }, error: new Error("offline") });
    await expect(adminListVideos()).rejects.toThrow("Nie udało się odczytać sesji");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("preserves structured Edge errors and rejects empty responses", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Brak uprawnień administratora." }), { status: 403 }) },
    });
    await expect(adminListVideos()).rejects.toThrow("Brak uprawnień administratora.");
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(adminListVideos()).rejects.toThrow("pustą odpowiedź");
  });

  it("keeps the complete Edge action schema and admin boundary after removing Start runtime", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-youtube/index.ts", import.meta.url), "utf8");
    const actions = [
      "listVideos", "getPublicChannel", "adminGetYoutubeSource", "adminSaveYoutubeKey", "adminTestYoutubeKey",
      "adminSaveYoutubeSource", "adminSyncYoutube", "adminSyncIfStale", "adminListVideos",
      "adminSetVideoStatus", "adminUpdateVideo", "adminAddManualVideo",
    ];
    for (const action of actions) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain('case "' + action + '":');
    }
    expect(edge).toContain("requireAdmin(db, req)");
    expect(existsSync(new URL("./voice.functions.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("./youtube.server.ts", import.meta.url))).toBe(false);
  });
});
