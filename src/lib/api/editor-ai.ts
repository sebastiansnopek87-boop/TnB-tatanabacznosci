import { supabase } from "@/integrations/supabase/client";

type Input<T = Record<string, unknown>> = { data: T };
async function invoke<T = any>(action: string, data?: unknown): Promise<T> {
  const body = data === undefined ? { action } : { action, data };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-editor-ai", { body });
  if (error) throw error;
  return result as T;
}

export const getEditorDashboard = () => invoke("getEditorDashboard");
export const listSources = () => invoke("listSources");
export const addWebSource = ({ data }: Input<{ url: string; comment?: string }>) => invoke("addWebSource", data);
export const addNoteSource = ({ data }: Input<{ kind: "note" | "idea"; title: string; content: string }>) => invoke("addNoteSource", data);
export const updateSource = ({ data }: Input) => invoke("updateSource", data);
export const deleteSource = ({ data }: Input<{ id: string }>) => invoke("deleteSource", data);
export const getEditorSettings = () => invoke("getEditorSettings");
export const saveEditorSettings = ({ data }: Input<{ guidelines: string; community_enabled: boolean; community_decision_note: string }>) => invoke("saveEditorSettings", data);
export const testAiConnection = () => invoke("testAiConnection");
export const previewAnalysisData = ({ data }: Input<{ scopes: Array<"articles" | "library" | "web" | "community" | "notes">; from: string | null; to: string | null }>) => invoke("previewAnalysisData", data);
export const runAnalysis = ({ data }: Input<{ scopes: Array<"articles" | "library" | "web" | "community" | "notes">; from: string | null; to: string | null; focus?: string }>) => invoke("runAnalysis", data);
export const listAnalyses = () => invoke("listAnalyses");
export const listProposals = () => invoke("listProposals");
export const updateProposal = ({ data }: Input) => invoke("updateProposal", data);
export const developProposal = ({ data }: Input<{ id: string; mode: "expand" | "outline" }>) => invoke("developProposal", data);
