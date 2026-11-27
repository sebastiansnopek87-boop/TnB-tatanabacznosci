import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  addNoteSource, addWebSource, deleteSource, developProposal, getEditorDashboard,
  getEditorSettings, listAnalyses, listProposals, listSources, previewAnalysisData,
  runAnalysis, saveEditorSettings, testAiConnection, updateProposal, updateSource,
} from "./api/editor-ai";

const id = "00000000-0000-4000-8000-000000000002";
const data = { id, probe: "editor-ai-contract" };

beforeEach(() => invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null }));

describe("editor AI SPA contract", () => {
  it("routes all fourteen actions through tnb-editor-ai", async () => {
    await Promise.all([
      getEditorDashboard(),
      listSources(),
      addWebSource({ data: { url: "https://example.com/article", comment: "Źródło" } }),
      addNoteSource({ data: { kind: "note", title: "Notatka", content: "Treść notatki" } }),
      updateSource({ data }),
      deleteSource({ data: { id } }),
      getEditorSettings(),
      saveEditorSettings({ data: { guidelines: "Zasady", community_enabled: false, community_decision_note: "" } }),
      testAiConnection(),
      previewAnalysisData({ data: { scopes: ["articles", "library"], from: null, to: null } }),
      runAnalysis({ data: { scopes: ["articles"], from: null, to: null, focus: "Temat" } }),
      listAnalyses(),
      listProposals(),
      updateProposal({ data }),
      developProposal({ data: { id, mode: "outline" } }),
    ]);
    const actions = [
      "getEditorDashboard", "listSources", "addWebSource", "addNoteSource", "updateSource",
      "deleteSource", "getEditorSettings", "saveEditorSettings", "testAiConnection",
      "previewAnalysisData", "runAnalysis", "listAnalyses", "listProposals",
      "updateProposal", "developProposal",
    ];
    expect(invoke).toHaveBeenCalledTimes(actions.length);
    for (const action of actions) {
      expect(invoke).toHaveBeenCalledWith("tnb-editor-ai", {
        body: ["getEditorDashboard", "listSources", "getEditorSettings", "testAiConnection", "listAnalyses", "listProposals"].includes(action)
          ? { action }
          : { action, data: expect.any(Object) },
      });
    }
  });

  it("propagates server-side superadmin denial", async () => {
    invoke.mockRejectedValueOnce(new Error("Asystent redakcyjny jest dostępny wyłącznie dla superadministratora."));
    await expect(getEditorDashboard()).rejects.toThrow("wyłącznie dla superadministratora");
  });

  it("keeps action schema, superadmin gate and PII scrubbing after removing Start", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-editor-ai/index.ts", import.meta.url), "utf8");
    const actions = [
      "getEditorDashboard", "listSources", "addWebSource", "addNoteSource", "updateSource",
      "deleteSource", "getEditorSettings", "saveEditorSettings", "testAiConnection",
      "previewAnalysisData", "runAnalysis", "listAnalyses", "listProposals",
      "updateProposal", "developProposal",
    ];
    for (const action of actions) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain('case "' + action + '"');
    }
    expect(edge).toContain("const s = db(), actor = await requireSuperadmin(s, req)");
    expect(edge).toContain('_role: "admin"');
    expect(edge).toContain('_role: "superadmin"');
    expect(edge).toContain("scrubPii");
    expect(edge).toContain("EMAIL_RE");
    expect(edge).toContain("PHONE_RE");
    expect(existsSync(new URL("./editor-ai.functions.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("./ai/editor.server.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("./ai/run-id.server.ts", import.meta.url))).toBe(false);
  });
});
