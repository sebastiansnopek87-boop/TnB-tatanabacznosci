import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  adminCreateLibraryUpload, adminFinalizeLibraryUpload, adminGetLibraryItem,
  adminLibraryCoverUrl, adminLibraryFileUrl, adminListLibrary, adminRemoveLibraryFile,
  adminRetryWatermark, adminSaveLibraryItem, adminSetLibraryStatus, getLibraryFileUrl,
} from "./api/library";

const id = "00000000-0000-4000-8000-000000000002";
const item = {
  id, title: "Materiał testowy", slug: "material-testowy", summary: "Opis", category: "poradnik",
  kind: "pdf", access: "public", status: "draft", author_name: "Redakcja", body: "Treść",
  price: "", purchasable: false, payment_product_id: "", delivery_method: "account_access",
  free_delivery: "direct", external_url: "",
};

beforeEach(() => invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null }));

describe("library SPA contract", () => {
  it("routes all library operations to tnb-library-admin with stable action/data envelopes", async () => {
    const calls = [
      adminListLibrary({ data: { q: "test", status: "draft", category: null, access: null } }),
      adminGetLibraryItem({ data: { id } }),
      adminSaveLibraryItem({ data: item }),
      adminSetLibraryStatus({ data: { id, status: "published" } }),
      adminCreateLibraryUpload({ data: { id, target: "file", name: "material.pdf", type: "application/pdf", size: 1024, premarked: false } }),
      adminFinalizeLibraryUpload({ data: { id, target: "file", path: "originals/" + id + "/file.pdf", name: "material.pdf", type: "application/pdf", premarked: false } }),
      adminRetryWatermark({ data: { id } }),
      adminLibraryFileUrl({ data: { id, which: "final", download: true } }),
      adminRemoveLibraryFile({ data: { id, target: "file" } }),
      getLibraryFileUrl({ data: { slug: "material-testowy" } }),
      adminLibraryCoverUrl({ data: { id } }),
    ];
    await Promise.all(calls);
    const actions = [
      "adminListLibrary", "adminGetLibraryItem", "adminSaveLibraryItem", "adminSetLibraryStatus",
      "adminCreateLibraryUpload", "adminFinalizeLibraryUpload", "adminRetryWatermark",
      "adminLibraryFileUrl", "adminRemoveLibraryFile", "getLibraryFileUrl", "adminLibraryCoverUrl",
    ];
    expect(invoke).toHaveBeenCalledTimes(actions.length);
    for (const action of actions) {
      expect(invoke).toHaveBeenCalledWith("tnb-library-admin", {
        body: expect.objectContaining({ action, data: expect.any(Object) }),
      });
    }
    expect(invoke).toHaveBeenCalledWith("tnb-library-admin", {
      body: { action: "getLibraryFileUrl", data: { slug: "material-testowy" } },
    });
  });

  it("surfaces Edge errors and rejects an empty response", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Brak uprawnień administratora." }), { status: 403 }) },
    });
    await expect(adminListLibrary({ data: { q: "", status: "all", category: null, access: null } }))
      .rejects.toThrow("Brak uprawnień administratora.");
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(adminGetLibraryItem({ data: { id } })).rejects.toThrow("pustą odpowiedź");
  });

  it("keeps the Edge action allowlist, admin gate, upload lifecycle and file-access checks explicit", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-library-admin/index.ts", import.meta.url), "utf8");
    const actions = [
      "adminListLibrary", "adminGetLibraryItem", "adminSaveLibraryItem", "adminSetLibraryStatus",
      "adminCreateLibraryUpload", "adminFinalizeLibraryUpload", "adminRetryWatermark",
      "adminLibraryFileUrl", "adminRemoveLibraryFile", "getLibraryFileUrl", "adminLibraryCoverUrl",
    ];
    for (const action of actions) expect(edge).toContain('z.literal("' + action + '")');
    expect(edge).toContain("const actor = await requireAdmin(s, req)");
    expect(edge).toContain("createSignedUploadUrl");
    expect(edge).toContain("adminFinalizeLibraryUpload");
    expect(edge).toContain("library_can_read");
    expect(edge).toContain("createSignedUrl");
    expect(edge).toContain("watermark_status");
    expect(edge).toContain("data.path.startsWith(expectedFolder");
    expect(edge).toContain("d.size > limit");
  });
});
