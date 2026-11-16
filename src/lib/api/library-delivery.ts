import { supabase } from "@/integrations/supabase/client";

type FreeMaterialInput = {
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  consent: true;
  website?: string;
  elapsedMs: number;
};

type FreeMaterialRequestResult =
  | { mode: "form_download"; token: string }
  | { mode: "email" };

type RedeemFreeMaterialResult =
  | { status: "ok"; url: string; title: string }
  | { status: "invalid" | "expired" | "unavailable" };

type LibraryRequest = {
  id: string;
  item_id: string;
  item_title: string;
  mode: "direct" | "form_download" | "email";
  status: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  consent_text: string | null;
  privacy_version: string | null;
  consent_at: string | null;
  token_expires_at: string | null;
  downloaded_at: string | null;
  download_count: number;
  notification_status: string | null;
  retention_until: string | null;
  created_at: string;
  updated_at: string;
};

type AdminListInput = {
  itemId?: string | null;
  email?: string;
  mode?: "direct" | "form_download" | "email" | null;
  status?: string | null;
};

type ApiError = { message?: unknown };

async function invokeLibraryDelivery<T>(
  action: "requestFreeMaterial" | "redeemFreeMaterial" | "adminListLibraryRequests" | "adminEraseLibraryRequest",
  data: Record<string, unknown>,
): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-library-delivery", {
    body: { action, data },
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) {
        throw new Error(payload.message);
      }
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą Biblioteki.");
  }
  if (result === null) throw new Error("Usługa Biblioteki zwróciła pustą odpowiedź.");
  return result as T;
}

export function requestFreeMaterial({ data }: { data: FreeMaterialInput }): Promise<FreeMaterialRequestResult> {
  return invokeLibraryDelivery("requestFreeMaterial", data);
}

export function redeemFreeMaterial({ data }: { data: { token: string } }): Promise<RedeemFreeMaterialResult> {
  return invokeLibraryDelivery("redeemFreeMaterial", data);
}

export function adminListLibraryRequests({ data }: { data: AdminListInput }): Promise<LibraryRequest[]> {
  return invokeLibraryDelivery("adminListLibraryRequests", data);
}

export function adminEraseLibraryRequest({ data }: { data: { id: string } }): Promise<{ ok: true }> {
  return invokeLibraryDelivery("adminEraseLibraryRequest", data);
}
