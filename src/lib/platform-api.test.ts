import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getSession, from, rpc } = vi.hoisted(() => ({
  invoke: vi.fn(),
  getSession: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession },
    functions: { invoke },
    from,
    rpc,
  },
}));

import {
  getPlatformSettings,
  setPrelaunchSettings,
  getSecurityStatus,
  setModuleVisibility,
  setPodcastLayout,
  setVisualEffects,
  updatePlatformSettings,
  getPublicPlatformSettings,
  getPodcastLayout as getPublicPodcastLayout,
} from "./api/platform";

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "admin-token" } }, error: null });
  from.mockReset();
  rpc.mockReset();
});

describe("platform settings SPA contract", () => {
  it("sends all protected actions to tnb-platform with the authenticated bearer token", async () => {
    await Promise.all([
      getPlatformSettings(),
      updatePlatformSettings({ data: { platform_name: "TNB" } }),
      setPrelaunchSettings({ data: { enabled: true, message: "Startujemy wkrótce." } }),
      setVisualEffects({ data: { effects: { enabled: true, intensity: "subtle", speed: "standard", reveal: true, interactive: true, panels: true } } }),
      setModuleVisibility({ data: { visibility: { library: { menu: true, page: true } } } }),
      setPodcastLayout({ data: { layout: "grid" } }),
      getSecurityStatus(),
    ]);

    const actions = ["getPlatformSettings", "updatePlatformSettings", "setPrelaunchSettings", "setVisualEffects", "setModuleVisibility", "setPodcastLayout", "getSecurityStatus"];
    expect(invoke).toHaveBeenCalledTimes(actions.length);
    for (const action of actions) {
      expect(invoke).toHaveBeenCalledWith("tnb-platform", {
        body: expect.objectContaining({ action }),
        headers: { Authorization: "Bearer admin-token" },
      });
    }
  });

  it("does not call privileged Edge actions without a session", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(getPlatformSettings()).rejects.toThrow("Sesja wygasła");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("preserves server error messages and rejects empty responses", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge request failed", context: new Response(JSON.stringify({ message: "Brak uprawnień administratora." }), { status: 403 }) },
    });
    await expect(getSecurityStatus()).rejects.toThrow("Brak uprawnień administratora.");

    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(getPlatformSettings()).rejects.toThrow("pustą odpowiedź");
  });

  it("keeps public settings reads on the anon table API, not the privileged Edge action", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { platform_name: "TNB" }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });
    await getPublicPlatformSettings();
    expect(from).toHaveBeenCalledWith("platform_settings");
    expect(select).toHaveBeenCalledWith(expect.stringContaining("platform_name"));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("keeps public podcast layout reads separate from protected writes", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { podcast_layout: "grid" }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });
    await expect(getPublicPodcastLayout()).resolves.toBe("grid");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("matches the Edge action allowlist, server-side role gates and public column boundary", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-platform/index.ts", import.meta.url), "utf8");
    const actions = ["getPlatformSettings", "updatePlatformSettings", "setVisualEffects", "setModuleVisibility", "setPodcastLayout", "getSecurityStatus"];

    for (const action of actions) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain('case "' + action + '"');
    }
    expect(edge).toContain('await requireAdmin(ctx)');
    expect(edge).toContain('await requireSuperadmin(ctx, "platform_settings")');
    expect(edge).toContain('await requireSuperadmin(ctx, "visual_effects")');
    expect(edge).toContain('await requireSuperadmin(ctx, "module_visibility")');
    expect(edge).toContain('const PUBLIC_COLS =');
    expect(edge).not.toMatch(/const PUBLIC_COLS = [^;]*billing_/);
    expect(edge).toContain('await requireAdmin(ctx);');
    expect(existsSync(new URL('./platform.functions.ts', import.meta.url))).toBe(false);
  });
});
