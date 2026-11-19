import { supabase } from "@/integrations/supabase/client";

type Input = { data: Record<string, unknown> };
type ApiError = { message?: unknown };

type LibraryListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  kind: string;
  status: string;
  access: string;
  cover_url: string | null;
  author_name: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  price_amount: number | null;
};
type LibraryItemDetails = {
  item: LibraryListItem & {
    purchasable: boolean;
    payment_product_id: string | null;
    delivery_method: string;
    free_delivery: string;
  };
  content: {
    body: string | null;
    external_url: string | null;
    file_path: string | null;
    original_path: string | null;
    file_name: string | null;
    watermark_status: string | null;
    watermark_error: string | null;
    watermark_source: string | null;
    pdf_generated_at: string | null;
    body_updated_at: string | null;
  };
};
type WatermarkResult = { status: "ready" | "failed"; error?: string };

async function invokeLibrary<T>(action: string, data: Record<string, unknown>): Promise<T> {
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
  return result;
}

export const adminListLibrary = ({ data }: Input) => invokeLibrary<LibraryListItem[]>("adminListLibrary", data);
export const adminGetLibraryItem = ({ data }: Input) => invokeLibrary<LibraryItemDetails>("adminGetLibraryItem", data);
export const adminSaveLibraryItem = ({ data }: Input) => invokeLibrary<{ id: string }>("adminSaveLibraryItem", data);
export const adminSetLibraryStatus = ({ data }: Input) => invokeLibrary<{ ok: true }>("adminSetLibraryStatus", data);
export const adminCreateLibraryUpload = ({ data }: Input) => invokeLibrary<{ path: string; token: string }>("adminCreateLibraryUpload", data);
export const adminFinalizeLibraryUpload = ({ data }: Input) => invokeLibrary<{ path: string | null; watermark: WatermarkResult | null }>("adminFinalizeLibraryUpload", data);
export const adminRetryWatermark = ({ data }: Input) => invokeLibrary<WatermarkResult>("adminRetryWatermark", data);
export const adminLibraryFileUrl = ({ data }: Input) => invokeLibrary<{ url: string }>("adminLibraryFileUrl", data);
export const adminRemoveLibraryFile = ({ data }: Input) => invokeLibrary<{ ok: true }>("adminRemoveLibraryFile", data);
export const getLibraryFileUrl = ({ data }: Input) => invokeLibrary<{ url: string }>("getLibraryFileUrl", data);
export const adminLibraryCoverUrl = ({ data }: Input) => invokeLibrary<{ url: string | null }>("adminLibraryCoverUrl", data);
