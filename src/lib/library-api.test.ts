import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  adminCreateLibraryUpload,
  adminFinalizeLibraryUpload,
  adminGetLibraryItem,
  adminLibraryCoverUrl,
  adminLibraryFileUrl,
  adminListLibrary,
  adminRemoveLibraryFile,
  adminRetryWatermark,
  adminSaveLibraryItem,
  adminSetLibraryStatus,
  getLibraryFileUrl,
} from "./api/library";
import {
  adminEraseLibraryRequest,
  adminListLibraryRequests,
  redeemFreeMaterial,
  requestFreeMaterial,
} from "./api/library-delivery";

const adminActions = [
  "adminListLibrary",
  "adminGetLibraryItem",
  "adminSaveLibraryItem",
  "adminSetLibraryStatus",
  "adminCreateLibraryUpload",
  "adminFinalizeLibraryUpload",
  "adminRetryWatermark",
  "adminLibraryFileUrl",
  "adminRemoveLibraryFile",
  "getLibraryFileUrl",
  "adminLibraryCoverUrl",
] as const;

const deliveryActions = [
  "requestFreeMaterial",
  "redeemFreeMaterial",
  "adminListLibraryRequests",
  "adminEraseLibraryRequest",
] as const;

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { ok: true }, error: null });
});

describe("library SPA adapter contracts", () => {
  it("keeps every admin action in the legacy exports and the Edge Function", () => {
    const legacy = readFileSync(new URL("./library.functions.ts", import.meta.url), "utf8");
    const edge = readFileSync(new URL("../../supabase/functions/tnb-library-admin/index.ts", import.meta.url), "utf8");

    for (const action of adminActions) {
      expect(legacy).toContain("export const " + action + " =");
      expect(edge).toContain('input.action === "' + action + '"');
    }
  });

  it("routes all admin operations through tnb-library-admin with their action and data", async () => {
    const data = { id: "11111111-1111-4111-8111-111111111111", probe: "library-contract" };
    await Promise.all([
      adminListLibrary({ data }), adminGetLibraryItem({ data }), adminSaveLibraryItem({ data }),
      adminSetLibraryStatus({ data }), adminCreateLibraryUpload({ data }), adminFinalizeLibraryUpload({ data }),
      adminRetryWatermark({ data }), adminLibraryFileUrl({ data }), adminRemoveLibraryFile({ data }),
      getLibraryFileUrl({ data }), adminLibraryCoverUrl({ data }),
    ]);

    expect(invoke).toHaveBeenCalledTimes(adminActions.length);
    for (const action of adminActions) {
      expect(invoke).toHaveBeenCalledWith("tnb-library-admin", {
        body: { action, data },
      });
    }
  });

  it("keeps every free-delivery action in the legacy exports and the Edge Function", () => {
    const legacy = readFileSync(new URL("./library-delivery.functions.ts", import.meta.url), "utf8");
    const edge = readFileSync(new URL("../../supabase/functions/tnb-library-delivery/index.ts", import.meta.url), "utf8");

    for (const action of deliveryActions) {
      expect(legacy).toContain("export const " + action + " =");
      expect(edge).toContain('action: z.literal("' + action + '")');
      if (action === "requestFreeMaterial" || action === "redeemFreeMaterial") {
        expect(edge).toContain('if (input.action === "' + action + '")');
      }
    }
  });

  it("routes free-delivery and request-history operations through tnb-library-delivery", async () => {
    const data = { probe: "delivery-contract" };
    await Promise.all([
      requestFreeMaterial({ data: { slug: "material", firstName: "Jan", lastName: "Kowalski", email: "jan@example.com", consent: true, elapsedMs: 3000 } }),
      redeemFreeMaterial({ data: { token: "x".repeat(32) } }),
      adminListLibraryRequests({ data }),
      adminEraseLibraryRequest({ data: { id: "11111111-1111-4111-8111-111111111111" } }),
    ]);

    expect(invoke).toHaveBeenCalledTimes(deliveryActions.length);
    for (const action of deliveryActions) {
      expect(invoke).toHaveBeenCalledWith("tnb-library-delivery", {
        body: { action, data: expect.any(Object) },
      });
    }
  });

  it("keeps admin operations behind server-verified admin role checks", () => {
    const adminEdge = readFileSync(new URL("../../supabase/functions/tnb-library-admin/index.ts", import.meta.url), "utf8");
    const deliveryEdge = readFileSync(new URL("../../supabase/functions/tnb-library-delivery/index.ts", import.meta.url), "utf8");

    expect(adminEdge).toContain('s.rpc("has_role", { _user_id: user.id, _role: "admin" })');
    expect(adminEdge.indexOf("const actor = await requireAdmin(s, req)")).toBeGreaterThan(adminEdge.indexOf('if (input.action === "getLibraryFileUrl")'));
    expect(deliveryEdge).toContain('s.rpc("has_role", { _user_id: user.id, _role: "admin" })');
    expect(deliveryEdge.indexOf("const actor = await requireAdmin(s, req)")).toBeGreaterThan(deliveryEdge.indexOf('if (input.action === "redeemFreeMaterial")'));
  });

  it("checks direct-download entitlement as the caller before issuing a service-role signed URL", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-library-admin/index.ts", import.meta.url), "utf8");
    const direct = edge.slice(edge.indexOf('if (input.action === "getLibraryFileUrl")'), edge.indexOf("const actor = await requireAdmin"));
    expect(direct).toContain('client.rpc("library_can_read", { _item: item.id })');
    expect(direct).toContain('s.storage.from(BUCKET).createSignedUrl(content.file_path, 300)');
    expect(direct.indexOf('client.rpc("library_can_read"')).toBeLessThan(direct.indexOf("createSignedUrl"));
  });

  it("binds redemption to a hashed token and the item recorded on its request", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-library-delivery/index.ts", import.meta.url), "utf8");
    const redeem = edge.slice(edge.indexOf('if (input.action === "redeemFreeMaterial")'), edge.indexOf("const actor = await requireAdmin"));
    expect(redeem).toContain('eq("token_hash", await sha256(input.data.token))');
    expect(redeem).toContain("request.item_id");
    expect(redeem).toContain("createSignedUrl(content.file_path, 300");
    expect(redeem).not.toContain("input.data.itemId");
  });

  it("keeps the Edge PDF watermark geometry and producer marker aligned with the legacy helper", () => {
    const legacy = readFileSync(new URL("./library/watermark.server.ts", import.meta.url), "utf8");
    const edge = readFileSync(new URL("../../supabase/functions/tnb-library-admin/index.ts", import.meta.url), "utf8");
    for (const source of [legacy, edge]) {
      expect(source).toContain("sizeMm: 8, rightMm: 4, bottomMm: 3");
      expect(source).toContain('doc.setProducer("TATA NA BACZNOŚCI — znak wodny TNB")');
      expect(source).toContain("width < 60 * MM");
    }
  });

  it("does not turn a failed Edge invocation into a successful library result", async () => {
    const failure = new Error("Brak uprawnień administratora.");
    invoke.mockResolvedValueOnce({ data: null, error: failure });
    await expect(adminListLibrary({ data: {} })).rejects.toThrow(failure.message);
  });
});
