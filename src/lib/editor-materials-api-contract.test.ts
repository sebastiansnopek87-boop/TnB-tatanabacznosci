import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  aiEditFragment, aiEditWhole, approveAndHandoff, finishMaterial, generateMaterialImage,
  getMaterial, listMaterials, materialImageUrls, previewCreateMaterial, restoreMaterialVersion,
  saveMaterial, setMaterialStatus, startMaterial, updateMaterialImage, writeMaterial,
} from "./api/editor-materials";

const id = "00000000-0000-4000-8000-000000000002";
const data = { id, instruction: "Popraw strukturę", confirmed: true };

beforeEach(() => invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null }));

describe("AI editorial materials SPA contract", () => {
  it("routes all fifteen actions through tnb-editor-materials", async () => {
    await Promise.all([
      previewCreateMaterial({ data }),
      startMaterial({ data }),
      writeMaterial({ data }),
      generateMaterialImage({ data }),
      updateMaterialImage({ data }),
      materialImageUrls({ data }),
      finishMaterial({ data }),
      listMaterials(),
      getMaterial({ data }),
      saveMaterial({ data }),
      setMaterialStatus({ data }),
      restoreMaterialVersion({ data }),
      aiEditFragment({ data }),
      aiEditWhole({ data }),
      approveAndHandoff({ data }),
    ]);
    const actions = [
      "previewCreateMaterial", "startMaterial", "writeMaterial", "generateMaterialImage",
      "updateMaterialImage", "materialImageUrls", "finishMaterial", "listMaterials",
      "getMaterial", "saveMaterial", "setMaterialStatus", "restoreMaterialVersion",
      "aiEditFragment", "aiEditWhole", "approveAndHandoff",
    ];
    expect(invoke).toHaveBeenCalledTimes(actions.length);
    for (const action of actions) {
      expect(invoke).toHaveBeenCalledWith("tnb-editor-materials", {
        body: action === "listMaterials" ? { action } : { action, data },
      });
    }
  });

  it("propagates server-side superadmin denial", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Tę operację może wykonać tylko superadministrator." }), { status: 403 }) },
    });
    await expect(approveAndHandoff({ data })).rejects.toThrow("Tę operację może wykonać tylko superadministrator.");
  });

  it("keeps the allowlist, server authentication and all-operation superadmin guard aligned with legacy", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-editor-materials/index.ts", import.meta.url), "utf8");
    const auth = readFileSync(new URL("../../supabase/functions/tnb-editor-materials/index-auth.ts", import.meta.url), "utf8");
    const logic = readFileSync(new URL("../../supabase/functions/tnb-editor-materials/logic.ts", import.meta.url), "utf8");
    const legacy = readFileSync(new URL("./editor-materials.functions.ts", import.meta.url), "utf8");
    const actions = [
      "previewCreateMaterial", "startMaterial", "writeMaterial", "generateMaterialImage",
      "updateMaterialImage", "materialImageUrls", "finishMaterial", "listMaterials",
      "getMaterial", "saveMaterial", "setMaterialStatus", "restoreMaterialVersion",
      "aiEditFragment", "aiEditWhole", "approveAndHandoff",
    ];
    for (const action of actions) {
      expect(edge).toContain('"' + action + '"');
      expect(logic).toContain("export const " + action + " =");
      expect(legacy).toContain("export const " + action + " =");
    }
    expect(edge).toContain("await requireSuperadminEdge(req)");
    expect(edge).toContain("const fn = (logic as unknown as Record<string, unknown>)[raw.action]");
    expect(auth).toContain("supabaseAdmin.auth.getUser(token)");
    expect(auth).toContain('_role: "admin"');
    expect(auth).toContain('_role: "superadmin"');
    expect(legacy).toContain("await assertSuperadmin(c, `ai_material:${op}`)");
    expect(logic).toContain("await assertSuperadmin(c, `ai_material:${op}`)");
  });
});
