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
      if (action === "adminCreateLibraryUpload" || action === "adminFinalizeLibraryUpload") expect(legacy).toContain("export const adminUploadLibraryFile =");
      else expect(legacy).toContain("export const " + action + " =");
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
      adminListLibraryRequests({ data: { itemId: null, email: "", mode: null, status: null } }),
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

  it("uses the exact owner-supplied logo bytes in the legacy helper and Edge Function", () => {
    const legacy = readFileSync(new URL("./library/watermark-logo.server.ts", import.meta.url), "utf8");
    const edge = readFileSync(new URL("../../supabase/functions/tnb-library-admin/watermark-logo.ts", import.meta.url), "utf8");
    const extract = (source: string) => source.match(/TNB_LOGO_PNG_BASE64\s*=\s*["']([^"']+)["']/)?.[1] ?? null;
    expect(extract(edge)).not.toBeNull();
    expect(extract(edge)).toBe(extract(legacy));
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

  it("rejects an empty Edge response", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(adminListLibrary({ data: {} })).rejects.toThrow("pustą odpowiedź");
  });

  it("does not turn a failed Edge invocation into a successful library result", async () => {
    const failure = new Error("Brak uprawnień administratora.");
    invoke.mockResolvedValueOnce({ data: null, error: failure });
    await expect(adminListLibrary({ data: {} })).rejects.toThrow(failure.message);
  });

  it("preserves uploaded cover images byte-for-byte by storing the uploaded object directly", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-library-admin/index.ts", import.meta.url), "utf8");
    const finalize = edge.slice(edge.indexOf('if (input.action === "adminFinalizeLibraryUpload")'), edge.indexOf('if (input.action === "adminRetryWatermark")'));
    expect(finalize).toContain('if (d.target === "cover")');
    expect(finalize).toContain('update({ cover_url: d.path })');
    expect(finalize).not.toContain("sharp");
    expect(finalize).not.toContain("canvas");
    expect(finalize).not.toContain("embedPng");
    expect(finalize).not.toContain("watermarkPdf");
    expect(finalize).toContain('return { path: d.path, watermark: null }');
  });

  it("retains the original PDF object and creates a separate marked derivative", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-library-admin/index.ts", import.meta.url), "utf8");
    const process = edge.slice(edge.indexOf("async function processPdf"), edge.indexOf("const Id = z.string().uuid()"));
    expect(process).toContain("original_path: input.originalPath");
    expect(process).toContain('download(input.originalPath)');
    expect(process).toContain('const path = "files/" + itemId + "/"');
    expect(process).toContain('upload(path, marked');
    expect(process).toContain("file_path: path");
    expect(process).not.toContain('upload(input.originalPath');
    expect(process).toContain('input.premarked ? bytes : await watermarkPdf(bytes)');
  });

  it("keeps supported image MIME types identical between legacy upload and the Edge contract", () => {
    const legacy = readFileSync(new URL("./library.functions.ts", import.meta.url), "utf8");
    const edge = readFileSync(new URL("../../supabase/functions/tnb-library-admin/index.ts", import.meta.url), "utf8");
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(legacy).toContain('"'+type+'"');
      expect(edge).toContain('"'+type+'"');
    }
  });

});
