import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import type { ArticleMeta, MaterialImage, MaterialSection, SourceUse } from "@/lib/editor-materials";

export type MaterialUsage = { input: number; output: number; calls?: number; images?: number };
export type MaterialDuplicate = { id: string; kind: string; title: string; score: number };
export type MaterialPreview = {
  ok: true; topic: string; format: string; sources: SourceUse[]; chars: number; tokens: number;
  summaries: number; duplicates: MaterialDuplicate[];
};
export type MaterialActionError = { ok: false; error: string };
export type MaterialActionOk = { ok: true };
export type MaterialCreated = { ok: true; id: string; sources: SourceUse[]; usage: MaterialUsage };
export type MaterialWritten = { ok: true; images: string[]; usage: MaterialUsage };
export type MaterialImageResult = { ok: true; file: string };
export type MaterialImageUpdate = { ok: true; imageId?: string };
export type MaterialEditResult = { ok: true; usage: MaterialUsage };
export type MaterialWholeEditResult = { ok: true; changed: boolean; report: string; usage: MaterialUsage };
export type MaterialHandoffResult = { ok: true; kind: "article" | "podcast"; targetId: string; images: number };
export type MaterialMeta = ArticleMeta & { direction?: string };
export type AiMaterial = {
  id: string;
  proposal_id: string | null;
  title: string;
  subtitle: string;
  format: string;
  status: string;
  sections: MaterialSection[];
  sources: SourceUse[];
  duplicates: MaterialDuplicate[];
  meta: MaterialMeta;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  last_author: string | null;
  handoff_kind: "article" | "library" | "podcast" | null;
  handoff_id: string | null;
  handoff_at: string | null;
};
export type MaterialListRow = {
  id: string; title: string; format: string; status: string; created_at: string; updated_at: string;
  last_author: string | null; handoff_kind: "article" | "library" | "podcast" | null; handoff_id: string | null;
  sourceCount: number; notes: number; imagesPending: number;
};
export type MaterialSnapshot = {
  title: string; subtitle: string; sections: MaterialSection[]; meta?: MaterialMeta;
};
export type MaterialVersion = {
  id: string; n: number; author: string; note: string; created_at: string; snapshot: MaterialSnapshot;
};
export type MaterialDetails = { material: AiMaterial; versions: MaterialVersion[]; authors: string[] };
export type MaterialStatus = "idea" | "to_create" | "generating" | "draft" | "editing" | "review" | "ready" | "published" | "rejected" | "archived";
export type MaterialSaveInput = {
  id: string; title: string; subtitle: string; sections: MaterialSection[]; meta?: MaterialMeta; note?: string;
};
export type MaterialPreviewInput = { proposalId: string | null; topic: string };
export type MaterialStartInput = {
  proposalId: string | null; topic: string; format: string; direction: string; confirmed: true;
};
export type MaterialImageAction = {
  id: string; imageId: string | null; action: "accept" | "delete" | "move" | "alt" | "add";
  afterSectionId?: string | null; alt?: string; description?: string;
};

type ApiError = { message?: unknown };
type Data = Record<string, unknown>;
async function invokeMaterials<T>(action: string, data?: Data): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (sessionError || !token) {
    throw new Error(sessionError ? "Nie udało się odczytać sesji. Zaloguj się ponownie." : "Sesja wygasła. Zaloguj się ponownie.");
  }
  const body = data === undefined ? { action } : { action, data };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-editor-materials", {
    body, headers: { Authorization: "Bearer " + token }
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z generatorem materiałów.");
  }
  if (result === null) throw new Error("Generator materiałów zwrócił pustą odpowiedź.");
  return result as T;
}

const idSchema = z.object({ id: z.string().uuid() });
export function previewCreateMaterial({ data }: { data: MaterialPreviewInput }): Promise<MaterialPreview | MaterialActionError> {
  return invokeMaterials("previewCreateMaterial", data);
}
export function startMaterial({ data }: { data: MaterialStartInput }): Promise<MaterialCreated | MaterialActionError> {
  return invokeMaterials("startMaterial", data);
}
export function writeMaterial({ data }: { data: { id: string } }): Promise<MaterialWritten | MaterialActionError> {
  return invokeMaterials("writeMaterial", idSchema.parse(data));
}
export function generateMaterialImage({ data }: { data: { id: string; imageId: string; description?: string } }): Promise<MaterialImageResult | MaterialActionError> {
  return invokeMaterials("generateMaterialImage", data);
}
export function updateMaterialImage({ data }: { data: MaterialImageAction }): Promise<MaterialImageUpdate | MaterialActionError> {
  return invokeMaterials("updateMaterialImage", data);
}
export function materialImageUrls({ data }: { data: { id: string } }): Promise<Record<string, string>> {
  return invokeMaterials("materialImageUrls", idSchema.parse(data));
}
export function finishMaterial({ data }: { data: { id: string } }): Promise<MaterialActionOk | MaterialActionError> {
  return invokeMaterials("finishMaterial", idSchema.parse(data));
}
export function listMaterials(): Promise<MaterialListRow[]> {
  return invokeMaterials("listMaterials");
}
export function getMaterial({ data }: { data: { id: string } }): Promise<MaterialDetails> {
  return invokeMaterials("getMaterial", idSchema.parse(data));
}
export function saveMaterial({ data }: { data: MaterialSaveInput }): Promise<MaterialActionOk | MaterialActionError> {
  return invokeMaterials("saveMaterial", data as unknown as Data);
}
export function setMaterialStatus({ data }: { data: { id: string; status: MaterialStatus } }): Promise<MaterialActionOk | MaterialActionError> {
  return invokeMaterials("setMaterialStatus", data);
}
export function restoreMaterialVersion({ data }: { data: { id: string; versionId: string } }): Promise<MaterialActionOk | MaterialActionError> {
  return invokeMaterials("restoreMaterialVersion", data);
}
export function aiEditFragment({ data }: { data: { id: string; sectionId: string; selection: string; instruction: string } }): Promise<MaterialEditResult | MaterialActionError> {
  return invokeMaterials("aiEditFragment", data);
}
export function aiEditWhole({ data }: { data: { id: string; instruction: string; confirmed: true } }): Promise<MaterialWholeEditResult | MaterialActionError> {
  return invokeMaterials("aiEditWhole", data);
}
export function approveAndHandoff({ data }: { data: { id: string; author: string } }): Promise<MaterialHandoffResult | MaterialActionError> {
  return invokeMaterials("approveAndHandoff", data);
}
