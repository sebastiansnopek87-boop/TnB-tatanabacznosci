import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { FreeDelivery, Kind, Status } from "@/lib/library";

type ApiError = { message?: unknown };
type ActionData = Record<string, unknown>;
type LibraryContentRecord = {
  body: string;
  file_path: string | null;
  file_name: string | null;
  external_url: string | null;
  original_path?: string | null;
  watermark_status?: string | null;
  watermark_error?: string | null;
  watermark_source?: string | null;
  pdf_generated_at?: string | null;
  body_updated_at?: string | null;
};
export type LibraryAdminItem = Tables<"library_items">;
export type LibraryAdminListRow = Pick<
  LibraryAdminItem,
  "id" | "slug" | "title" | "summary" | "category" | "kind" | "status" | "access" |
  "cover_url" | "author_name" | "published_at" | "created_at" | "updated_at" | "price_amount"
>;
export type LibraryAdminForm = {
  id: string | null;
  title: string;
  slug: string;
  summary: string;
  category: string;
  kind: Kind;
  access: "public" | "members" | "premium";
  status: Status;
  author_name: string;
  body: string;
  price: string;
  purchasable: boolean;
  payment_product_id: string;
  delivery_method: "email_link" | "email_attachment" | "account_access";
  free_delivery: FreeDelivery;
  external_url: string;
};
export type LibraryUploadTarget = "cover" | "file";
export type LibraryWatermarkResult = { status: "ready" } | { status: "failed"; error: string };

async function invokeLibrary<T>(action: string, data: ActionData, allowAnonymous = false): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!allowAnonymous && (sessionError || !accessToken)) {
    throw new Error(sessionError ? "Nie udało się odczytać sesji. Zaloguj się ponownie." : "Sesja wygasła. Zaloguj się ponownie.");
  }
  const headers: Record<string, string> = {};
  if (accessToken) headers["Authorization"] = "Bearer " + accessToken;
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-library-admin", { body: { action, data }, headers });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą Biblioteki.");
  }
  if (result === null) throw new Error("Usługa Biblioteki zwróciła pustą odpowiedź.");
  return result as T;
}

export function adminListLibrary({ data }: { data: {
  q?: string; status?: "all" | Status; category?: string | null; access?: "public" | "members" | "premium" | null;
} }): Promise<LibraryAdminListRow[]> {
  return invokeLibrary("adminListLibrary", data);
}
export function adminGetLibraryItem({ data }: { data: { id: string } }): Promise<{
  item: LibraryAdminItem & { free_delivery?: FreeDelivery };
  content: LibraryContentRecord;
}> {
  return invokeLibrary("adminGetLibraryItem", data);
}
export function adminSaveLibraryItem({ data }: { data: LibraryAdminForm }): Promise<{ id: string }> {
  return invokeLibrary("adminSaveLibraryItem", data as unknown as ActionData);
}
export function adminSetLibraryStatus({ data }: { data: { id: string; status: Status } }): Promise<{ ok: true }> {
  return invokeLibrary("adminSetLibraryStatus", data);
}
export function adminCreateLibraryUpload({ data }: { data: {
  id: string; target: LibraryUploadTarget; name: string; type: string; size: number; premarked?: boolean;
} }): Promise<{ path: string; token: string }> {
  return invokeLibrary("adminCreateLibraryUpload", data);
}
export function adminFinalizeLibraryUpload({ data }: { data: {
  id: string; target: LibraryUploadTarget; path: string; name: string; type: string; premarked?: boolean;
} }): Promise<{ path: string | null; watermark: LibraryWatermarkResult | null }> {
  return invokeLibrary("adminFinalizeLibraryUpload", data);
}
export function adminRetryWatermark({ data }: { data: { id: string } }): Promise<LibraryWatermarkResult> {
  return invokeLibrary("adminRetryWatermark", data);
}
export function adminLibraryFileUrl({ data }: { data: { id: string; which: "final" | "original"; download: boolean } }): Promise<{ url: string }> {
  return invokeLibrary("adminLibraryFileUrl", data);
}
export function adminRemoveLibraryFile({ data }: { data: { id: string; target: LibraryUploadTarget } }): Promise<{ ok: true }> {
  return invokeLibrary("adminRemoveLibraryFile", data);
}
export function getLibraryFileUrl({ data }: { data: { slug: string } }): Promise<{ url: string }> {
  return invokeLibrary("getLibraryFileUrl", data, true);
}
export function adminLibraryCoverUrl({ data }: { data: { id: string } }): Promise<{ url: string | null }> {
  return invokeLibrary("adminLibraryCoverUrl", data);
}
