import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { SubmissionStatus } from "@/lib/voice";

type Input<T> = { data: T };
type ApiError = { message?: unknown };

export const storySchema = z.object({
  name: z.string().trim().min(1, "Podaj imię i nazwisko").max(120, "Maksymalnie 120 znaków"),
  email: z.string().trim().email("Podaj poprawny adres e-mail").max(255),
  phone: z.string().trim().max(40, "Maksymalnie 40 znaków").regex(/^[0-9+()\\s-]*$/, "Numer może zawierać tylko cyfry, spacje i znaki + ( ) -"),
  about: z.string().trim().max(1000, "Maksymalnie 1000 znaków"),
  topic: z.string().trim().min(1, "Napisz, o czym chcesz porozmawiać").max(1000, "Maksymalnie 1000 znaków"),
  story: z.string().trim().min(20, "Opowiedz swoją historię (co najmniej 20 znaków)").max(5000, "Maksymalnie 5000 znaków"),
  why: z.string().trim().max(2000, "Maksymalnie 2000 znaków"),
  profile_url: z.string().trim().max(500, "Maksymalnie 500 znaków"),
  consent: z.literal(true, { errorMap: () => ({ message: "Zaznacz zgodę na kontakt" }) }),
});

async function invokeVoice<T>(action: string, data?: unknown): Promise<T> {
  const body = data === undefined ? { action } : { action, data };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-voice", { body });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą Głosu TNB.");
  }
  return result as T;
}

export type VoiceSubmission = {
  id: string; name: string; email: string; phone: string | null; about: string; topic: string; story: string;
  why: string; profile_url: string | null; status: SubmissionStatus; admin_note: string; created_at: string; updated_at: string;
};
export type PublicReel = {
  id: string; media_type: string; product_type: string | null; thumbnail_url: string | null;
  permalink: string; caption: string | null; posted_at: string;
};
export type InstagramSettings = {
  id: number; status: string; username: string | null; profile_url: string | null; display_count: number | null;
  show_reels: boolean | null; show_posts: boolean | null; show_carousels: boolean | null; media_count: number;
  last_sync_at: string | null; last_sync_added: number; last_error: string | null;
  appConfigured: boolean; callbackPath: string; productionCallback: string | null;
};

export function submitVoiceStory({ data }: Input<z.infer<typeof storySchema> & { website?: string; elapsedMs: number }>): Promise<{ ok: true }> {
  return invokeVoice("submitVoiceStory", data);
}
export function adminListSubmissions(): Promise<VoiceSubmission[]> {
  return invokeVoice("adminListSubmissions");
}
export function adminUpdateSubmission({ data }: Input<{ id: string; status: SubmissionStatus; admin_note: string }>): Promise<{ ok: true }> {
  return invokeVoice("adminUpdateSubmission", data);
}
export function listInstagram(): Promise<{ connected: boolean; username: string | null; profileUrl: string | null; items: PublicReel[] }> {
  return invokeVoice("listInstagram");
}
export function adminGetInstagram(): Promise<InstagramSettings> {
  return invokeVoice("adminGetInstagram");
}
export function adminCheckInstagramConfig(): Promise<{ ok: boolean; checks: Array<{ key: string; ok: boolean; label: string; optional?: boolean; hint?: string }> }> {
  return invokeVoice("adminCheckInstagramConfig");
}
export function adminStartInstagramConnect({ data }: Input<{ origin: string }>): Promise<{ url: string }> {
  return invokeVoice("adminStartInstagramConnect", data);
}
export function adminSyncInstagram(): Promise<{ added: number; total: number }> {
  return invokeVoice("adminSyncInstagram");
}
export function adminDisconnectInstagram(): Promise<{ ok: true }> {
  return invokeVoice("adminDisconnectInstagram");
}
export function adminSaveInstagramOptions({ data }: Input<{ show_reels: boolean; show_posts: boolean; show_carousels: boolean; display_count: number }>): Promise<{ ok: true }> {
  return invokeVoice("adminSaveInstagramOptions", data);
}
export function finishInstagramOAuth({ data }: Input<{ state: string; code: string }>): Promise<{ ok: true; username: string }> {
  return invokeVoice("finishInstagramOAuth", data);
}
export function cronInstagramSync(): Promise<{ ok: true }> {
  return invokeVoice("cronInstagramSync");
}
