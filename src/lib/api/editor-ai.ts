import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const PROPOSAL_STATUSES = ["new", "considering", "accepted", "rejected", "later", "in_progress", "done"] as const;
export const FORMATS = ["e-book", "poradnik", "artykuł", "podcast", "materiał edukacyjny", "zeszyt ćwiczeń", "karty refleksji", "spotkanie społeczności"] as const;
export type EditorScope = "articles" | "library" | "web" | "community" | "notes";
export type EditorDashboard = {
  approved: number; pending: number; articles: number; library: number; fresh: number; accepted: number;
  lastAnalysis: { created_at: string; status: string } | null; aiConfigured: boolean; model: string; communityEnabled: boolean;
};
export type EditorSource = {
  id: string; kind: "web" | "note" | "idea"; status: "pending" | "approved" | "rejected"; title: string;
  url: string | null; author: string | null; published_on: string | null; admin_comment: string | null; content: string;
  fetch_status: string; fetch_error: string | null; created_at: string; reviewed_at: string | null;
};
export type EditorSourcePatch = {
  title?: string; author?: string | null; published_on?: string | null; admin_comment?: string; content?: string; status?: "pending" | "approved" | "rejected";
};
export type EditorSettings = { guidelines: string; community_enabled: boolean; community_decision_note: string; updated_at: string | null };
export type EditorSettingsInput = Pick<EditorSettings, "guidelines" | "community_enabled" | "community_decision_note">;
export type AnalysisPreview = {
  docs: Array<{ ref: string; kind: string; title: string; chars: number }>;
  communityCount: number; communityBlocked: boolean; totalChars: number;
};
export type ProposalRef = { ref: string; kind: string; id: string; title: string; url: string | null };
export type ProposalData = {
  need?: string; audience?: string; threads?: string[]; structure?: string[];
  related?: ProposalRef[]; sources?: ProposalRef[];
  facts?: Array<{ text: string; source: ProposalRef | null }>;
  suggestions?: string[]; duplicate_warning?: string; next_steps?: string[];
};
export type AiProposal = {
  id: string; analysis_id: string; title: string; format: string; description: string; data: ProposalData; status: string;
  created_at: string; reject_reason: string | null; linked_kind: "article" | "library" | null; linked_id: string | null;
  expansion: string | null; outline: string | null;
};
export type AiProposalEvent = {
  proposal_id: string; action: string; from_status: string | null; to_status: string | null; note: string | null; created_at: string;
};
export type AiLinkedMaterial = { kind: "article" | "library"; id: string; title: string };
export type AiAnalysisFinding = { text: string; refs: ProposalRef[] };
export type AiAnalysis = {
  id: string; created_at: string; finished_at: string | null; scope: EditorScope[]; period_from: string | null;
  period_to: string | null; status: string; source_count: number; sources_used: ProposalRef[];
  findings: Record<string, AiAnalysisFinding[]> & { skipped?: string[] }; error: string | null;
};
type ApiError = { message?: unknown };
type ActionData = Record<string, unknown>;

async function invokeEditorAi<T>(action: string, data?: ActionData): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (sessionError || !token) throw new Error(sessionError ? "Nie udało się odczytać sesji. Zaloguj się ponownie." : "Sesja wygasła. Zaloguj się ponownie.");
  const body = data === undefined ? { action } : { action, data };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-editor-ai", { body, headers: { Authorization: "Bearer " + token } });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z asystentem redakcyjnym.");
  }
  if (result === null) throw new Error("Asystent redakcyjny zwrócił pustą odpowiedź.");
  return result as T;
}

export function getEditorDashboard(): Promise<EditorDashboard> { return invokeEditorAi("getEditorDashboard"); }
export function listSources(): Promise<EditorSource[]> { return invokeEditorAi("listSources"); }
export function addWebSource({ data }: { data: { url: string; comment?: string } }): Promise<{ ok: boolean; id?: string; fetched?: boolean; error?: string | null }> {
  return invokeEditorAi("addWebSource", data);
}
export function addNoteSource({ data }: { data: { kind: "note" | "idea"; title: string; content: string } }): Promise<{ ok: boolean; id?: string; error?: string }> {
  return invokeEditorAi("addNoteSource", data);
}
export function updateSource({ data }: { data: { id: string } & EditorSourcePatch }): Promise<{ ok: boolean; error?: string }> {
  return invokeEditorAi("updateSource", data);
}
export function deleteSource({ data }: { data: { id: string } }): Promise<{ ok: boolean; error?: string }> {
  return invokeEditorAi("deleteSource", data);
}
export function getEditorSettings(): Promise<EditorSettings> { return invokeEditorAi("getEditorSettings"); }
export function saveEditorSettings({ data }: { data: EditorSettingsInput }): Promise<{ ok: boolean; error?: string }> {
  return invokeEditorAi("saveEditorSettings", data);
}
export function testAiConnection(): Promise<{ ok: boolean; reply?: string; error?: string }> { return invokeEditorAi("testAiConnection"); }
const analysisInput = z.object({
  scopes: z.array(z.enum(["articles", "library", "web", "community", "notes"])).min(1),
  from: z.string().nullable(), to: z.string().nullable(),
});
export function previewAnalysisData({ data }: { data: z.infer<typeof analysisInput> }): Promise<AnalysisPreview> {
  return invokeEditorAi("previewAnalysisData", analysisInput.parse(data));
}
export function runAnalysis({ data }: { data: z.infer<typeof analysisInput> & { focus?: string } }): Promise<
  { ok: true; id: string; proposals: number; skipped: number } | { ok: false; error: string }
> {
  return invokeEditorAi("runAnalysis", { ...analysisInput.parse(data), focus: data.focus ?? "" });
}
export function listAnalyses(): Promise<AiAnalysis[]> { return invokeEditorAi("listAnalyses"); }
export function listProposals(): Promise<{ proposals: AiProposal[]; events: AiProposalEvent[]; materials: AiLinkedMaterial[] }> {
  return invokeEditorAi("listProposals");
}
export function updateProposal({ data }: { data: {
  id: string; status?: (typeof PROPOSAL_STATUSES)[number]; reason?: string; title?: string; description?: string;
  link?: { kind: "article" | "library"; id: string } | null;
} }): Promise<{ ok: boolean; error?: string }> {
  return invokeEditorAi("updateProposal", data);
}
export function developProposal({ data }: { data: { id: string; mode: "expand" | "outline" } }): Promise<{ ok: boolean; error?: string }> {
  return invokeEditorAi("developProposal", data);
}
