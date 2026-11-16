import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const name = (message: string, max = 60) =>
  z.string().trim().min(1, message).max(max).regex(/^[\p{L}][\p{L}\s'.-]*$/u, "Pole zawiera niedozwolone znaki.");
export const freeMaterialRequestSchema = z.object({
  slug: z.string().max(120),
  firstName: name("Podaj imię."),
  lastName: name("Podaj nazwisko.", 80),
  email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
  consent: z.literal(true),
  website: z.string().max(0).optional().default(""),
  elapsedMs: z.number().int().nonnegative(),
});
export type LibraryRequestMode = "direct" | "form_download" | "email";
export type LibraryRequestRow = {
  id: string; item_id: string; item_title: string; mode: LibraryRequestMode; status: string; user_id: string | null;
  first_name: string | null; last_name: string | null; email: string | null; consent_text: string | null;
  privacy_version: string | null; consent_at: string | null; token_expires_at: string | null; downloaded_at: string | null;
  download_count: number; notification_status: string | null; retention_until: string; created_at: string; updated_at: string;
};
type ApiError = { message?: unknown };
async function invokeLibraryDelivery<T>(action: string, data: Record<string, unknown>): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-library-delivery", { body: { action, data } });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą pobierania materiałów.");
  }
  if (result === null) throw new Error("Usługa pobierania materiałów zwróciła pustą odpowiedź.");
  return result as T;
}
export function requestFreeMaterial({ data }: { data: z.infer<typeof freeMaterialRequestSchema> }): Promise<
  { mode: "form_download"; token: string } | { mode: "email" }
> {
  return invokeLibraryDelivery("requestFreeMaterial", data);
}
export function redeemFreeMaterial({ data }: { data: { token: string } }): Promise<
  { status: "ok"; url: string; title: string } | { status: "invalid" | "expired" | "unavailable" }
> {
  return invokeLibraryDelivery("redeemFreeMaterial", data);
}
export function adminListLibraryRequests({ data }: { data: {
  itemId?: string | null; email?: string; mode?: "direct" | "form_download" | "email" | null; status?: string | null;
} }): Promise<LibraryRequestRow[]> {
  return invokeLibraryDelivery("adminListLibraryRequests", data);
}
export function adminEraseLibraryRequest({ data }: { data: { id: string } }): Promise<{ ok: true }> {
  return invokeLibraryDelivery("adminEraseLibraryRequest", data);
}
