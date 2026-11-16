import { supabase } from "@/integrations/supabase/client";

type Input = { data: Record<string, any> };
type ApiError = { message?: unknown };

async function invokeEditorMaterials<T>(action: string, data?: Record<string, any>): Promise<T> {
  const body = data === undefined ? { action } : { action, data };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-editor-materials", { body });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą materiałów AI.");
  }
  return result as T;
}

export const previewCreateMaterial = ({ data }: Input) => invokeEditorMaterials<any>("previewCreateMaterial", data);
export const startMaterial = ({ data }: Input) => invokeEditorMaterials<any>("startMaterial", data);
export const writeMaterial = ({ data }: Input) => invokeEditorMaterials<any>("writeMaterial", data);
export const generateMaterialImage = ({ data }: Input) => invokeEditorMaterials<any>("generateMaterialImage", data);
export const updateMaterialImage = ({ data }: Input) => invokeEditorMaterials<any>("updateMaterialImage", data);
export const materialImageUrls = ({ data }: Input) => invokeEditorMaterials<any>("materialImageUrls", data);
export const finishMaterial = ({ data }: Input) => invokeEditorMaterials<any>("finishMaterial", data);
export const listMaterials = () => invokeEditorMaterials<any[]>("listMaterials");
export const getMaterial = ({ data }: Input) => invokeEditorMaterials<any>("getMaterial", data);
export const saveMaterial = ({ data }: Input) => invokeEditorMaterials<any>("saveMaterial", data);
export const setMaterialStatus = ({ data }: Input) => invokeEditorMaterials<any>("setMaterialStatus", data);
export const restoreMaterialVersion = ({ data }: Input) => invokeEditorMaterials<any>("restoreMaterialVersion", data);
export const aiEditFragment = ({ data }: Input) => invokeEditorMaterials<any>("aiEditFragment", data);
export const aiEditWhole = ({ data }: Input) => invokeEditorMaterials<any>("aiEditWhole", data);
export const approveAndHandoff = ({ data }: Input) => invokeEditorMaterials<any>("approveAndHandoff", data);
