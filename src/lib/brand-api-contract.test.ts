import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getSession } = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession }, functions: { invoke } },
}));

import {
  createBrandUpload, finalizeBrandUpload, getBrandSettings, saveBrandSettings,
} from "./api/brand";

const settings = {
  logo: "brand/logo.png", favicon: "brand/favicon.ico", og_image: "", header_image: "",
  header_size: "large", site_name: "Tata Na Baczności", slogan: "Razem", show_slogan: true,
  public_title: "TNB", public_description: "Opis", site_url: "https://tatanabacznosci.pl",
};

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "admin-token" } }, error: null });
});

describe("brand SPA contract", () => {
  it("routes all four actions with the exact flat Edge payloads", async () => {
    await Promise.all([
      getBrandSettings(),
      createBrandUpload({ data: { name: "logo.png", type: "image/png", size: 1024 } }),
      finalizeBrandUpload({ data: { path: "brand/logo.png" } }),
      saveBrandSettings({ data: settings }),
    ]);
    expect(invoke).toHaveBeenCalledTimes(4);
    for (const body of [
      { action: "getBrandSettings" },
      { action: "createBrandUpload", name: "logo.png", type: "image/png", size: 1024 },
      { action: "finalizeBrandUpload", path: "brand/logo.png" },
      { action: "saveBrandSettings", settings },
    ]) {
      expect(invoke).toHaveBeenCalledWith("tnb-brand", {
        body,
        headers: { Authorization: "Bearer admin-token" },
      });
    }
  });

  it("blocks calls without a session and preserves Edge permission errors", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(getBrandSettings()).rejects.toThrow("Sesja wygasła");
    expect(invoke).not.toHaveBeenCalled();
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Tę zmianę może wykonać tylko superadministrator." }), { status: 403 }) },
    });
    await expect(saveBrandSettings({ data: settings })).rejects.toThrow("Tę zmianę może wykonać tylko superadministrator.");
  });

  it("keeps admin read, superadmin writes, upload limits and storage verification explicit", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-brand/index.ts", import.meta.url), "utf8");
    const legacy = readFileSync(new URL("./brand.functions.ts", import.meta.url), "utf8");
    for (const action of ["getBrandSettings", "createBrandUpload", "finalizeBrandUpload", "saveBrandSettings"]) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain('case "' + action + '":');
    }
    expect(edge).toContain("await requireAdmin(ctx)");
    expect(edge).toContain("await requireSuperadmin(ctx)");
    expect(edge).toContain("input.size > MAX_SIZE");
    expect(edge).toContain("size <= MAX_SIZE");
    expect(edge).toContain("MIME_EXT[mime]");
    expect(edge).toContain("createSignedUploadUrl");
    expect(edge).toContain(".storage.from(BUCKET).remove([path])");
    for (const action of ["getBrandSettings", "createBrandUpload", "finalizeBrandUpload", "saveBrandSettings"]) {
      expect(legacy).toContain("export const " + action + " =");
    }
  });
});
