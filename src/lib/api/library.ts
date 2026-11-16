import { supabase } from "@/integrations/supabase/client";

type Input = { data: Record<string, any> };
type ApiError = { message?: unknown };

async function invokeLibrary<T>(action: string, data: Record<string, any>): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-library-admin", { body: { action, data } });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą Biblioteki.");
  }
  if (result == null) throw new Error("Usługa Biblioteki zwróciła pustą odpowiedź.");
  return result as T;
}

export const adminListLibrary = ({ data }: Input) => invokeLibrary<any[]>("adminListLibrary", data);
export const adminGetLibraryItem = ({ data }: Input) => invokeLibrary<any>("adminGetLibraryItem", data);
export const adminSaveLibraryItem = ({ data }: Input) => invokeLibrary<{ id: string }>("adminSaveLibraryItem", data);
export const adminSetLibraryStatus = ({ data }: Input) => invokeLibrary<{ ok: true }>("adminSetLibraryStatus", data);
export const adminCreateLibraryUpload = ({ data }: Input) => invokeLibrary<{ path: string; token: string }>("adminCreateLibraryUpload", data);
export const adminFinalizeLibraryUpload = ({ data }: Input) => invokeLibrary<{ path: string | null; watermark: any | null }>("adminFinalizeLibraryUpload", data);
export const adminRetryWatermark = ({ data }: Input) => invokeLibrary<any>("adminRetryWatermark", data);
export const adminLibraryFileUrl = ({ data }: Input) => invokeLibrary<{ url: string }>("adminLibraryFileUrl", data);
export const adminRemoveLibraryFile = ({ data }: Input) => invokeLibrary<{ ok: true }>("adminRemoveLibraryFile", data);
export const getLibraryFileUrl = ({ data }: Input) => invokeLibrary<{ url: string }>("getLibraryFileUrl", data);
export const adminLibraryCoverUrl = ({ data }: Input) => invokeLibrary<{ url: string | null }>("adminLibraryCoverUrl", data);
