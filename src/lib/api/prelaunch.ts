import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const PRELAUNCH_CONSENT_VERSION = "2026-11-22";
export const PRELAUNCH_CONSENT_TEXT =
  "Wyrażam zgodę na przetwarzanie mojego imienia i adresu e-mail w celu otrzymania jednorazowej informacji o uruchomieniu platformy Tata Na Baczności. Zapis nie oznacza subskrypcji newslettera. Zgodę mogę wycofać w każdej chwili.";

export const prelaunchSignupSchema = z.object({
  first_name: z.string().trim().min(2, "Wpisz imię (co najmniej 2 znaki).").max(100, "Imię jest za długie."),
  email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(255, "Adres jest za długi."),
  consent: z.boolean().refine((value) => value, "Zaznacz zgodę na jednorazową informację o uruchomieniu TNB."),
});

export type PrelaunchSignupResult = {
  status: "subscribed" | "already" | "reactivated";
  unsubscribeToken?: string;
};
export type PrelaunchStatus = "all" | "active" | "withdrawn" | "notified";
export type PrelaunchRow = {
  id: string;
  first_name: string;
  email: string;
  status: Exclude<PrelaunchStatus, "all">;
  consent_version: string;
  consent_given_at: string;
  created_at: string;
  withdrawn_at: string | null;
  notified_at: string | null;
};
export type PrelaunchListResult = {
  rows: PrelaunchRow[];
  total: number;
  counts: { active: number; withdrawn: number; notified: number };
};

type ApiError = { message?: unknown };

async function invoke<T>(body: Record<string, unknown>, admin = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (admin) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const { data, error } = await supabase.functions.invoke<T>("tnb-newsletter", { body, headers });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z listą przedpremierową.");
  }
  if (data === null) throw new Error("Usługa listy przedpremierowej zwróciła pustą odpowiedź.");
  return data as T;
}

export function signupPrelaunch({ data }: { data: z.input<typeof prelaunchSignupSchema> & { website?: string; elapsedMs: number } }): Promise<PrelaunchSignupResult> {
  return invoke({ action: "prelaunchSignup", data });
}
export function unsubscribePrelaunch({ data }: { data: { token: string } }): Promise<{ ok: true }> {
  return invoke({ action: "prelaunchUnsubscribe", data });
}
export function listPrelaunchSignups({ data }: { data: { status: PrelaunchStatus } }): Promise<PrelaunchListResult> {
  return invoke<PrelaunchListResult>({ action: "adminListPrelaunch", data }, true);
}
