import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import type { SubmissionStatus } from "@/lib/voice";

export const storySchema = z.object({
  name: z.string().trim().min(1, "Podaj imię i nazwisko").max(120, "Maksymalnie 120 znaków"),
  email: z.string().trim().email("Podaj poprawny adres e-mail").max(255),
  phone: z.string().trim().max(40, "Maksymalnie 40 znaków").regex(/^[0-9+()\s-]*$/, "Numer może zawierać tylko cyfry, spacje i znaki + ( ) -"),
  about: z.string().trim().max(1000, "Maksymalnie 1000 znaków"),
  topic: z.string().trim().min(1, "Napisz, o czym chcesz porozmawiać").max(1000, "Maksymalnie 1000 znaków"),
  story: z.string().trim().min(20, "Opowiedz swoją historię (co najmniej 20 znaków)").max(5000, "Maksymalnie 5000 znaków"),
  why: z.string().trim().max(2000, "Maksymalnie 2000 znaków"),
  profile_url: z.string().trim().max(500, "Maksymalnie 500 znaków"),
  consent: z.literal(true, { errorMap: () => ({ message: "Zaznacz zgodę na kontakt" }) }),
});
export type VoiceStoryInput = z.infer<typeof storySchema> & { website?: string; elapsedMs: number };
export type PublicReel = {
  id: string; media_type: string; product_type: string | null; thumbnail_url: string | null;
  permalink: string; caption: string | null; posted_at: string;
};
export type InstagramPublicFeed = { connected: boolean; username: string | null; profileUrl: string | null; items: PublicReel[] };
export type VoiceSubmission = {
  id: string; name: string; email: string; phone: string | null; about: string | null;
  topic: string; story: string; why: string | null; profile_url: string | null;
  status: SubmissionStatus; admin_note: string; created_at: string; updated_at: string;
};
export type InstagramSource = {
  id: number; status: string; username: string | null; profile_url: string | null; display_count: number;
  show_reels: boolean; show_posts: boolean; show_carousels: boolean; last_sync_at: string | null; last_error: string | null;
  connected_at: string | null; connected_by: string | null; media_count: number; last_sync_added?: number | null; [key: string]: unknown;
};
export type InstagramCheck = {
  ok: boolean;
  checks: Array<{ key: string; label: string; ok: boolean; hint?: string; optional?: boolean }>;
};
type ApiError = { message?: unknown };
type Data = Record<string, unknown>;
type InvokeOptions = { allowAnonymous?: boolean };
async function invokeVoice<T>(action: string, data?: Data, options: InvokeOptions = {}): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (sessionError && !options.allowAnonymous) throw new Error("Nie udało się odczytać sesji. Zaloguj się ponownie.");
  if (!token && !options.allowAnonymous) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  const body = data === undefined ? { action } : { action, data };
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-voice", { body, headers });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą Głosu TNB.");
  }
  if (result === null) throw new Error("Usługa Głosu TNB zwróciła pustą odpowiedź.");
  return result as T;
}

export function submitVoiceStory({ data }: { data: VoiceStoryInput }): Promise<{ ok: true }> {
  const parsed = storySchema.parse(data);
  return invokeVoice("submitVoiceStory", { ...parsed, website: data.website ?? "", elapsedMs: data.elapsedMs }, { allowAnonymous: true });
}
export function adminListSubmissions(): Promise<VoiceSubmission[]> { return invokeVoice("adminListSubmissions"); }
export function adminUpdateSubmission({ data }: { data: { id: string; status: SubmissionStatus; admin_note: string } }): Promise<{ ok: true }> {
  return invokeVoice("adminUpdateSubmission", data);
}
export function listInstagram(): Promise<InstagramPublicFeed> { return invokeVoice("listInstagram", undefined, { allowAnonymous: true }); }
export function adminGetInstagram(): Promise<(InstagramSource & { appConfigured: boolean; callbackPath: string; productionCallback: string | null }) | null> {
  return invokeVoice("adminGetInstagram");
}
export function adminCheckInstagramConfig(): Promise<InstagramCheck> { return invokeVoice("adminCheckInstagramConfig"); }
export function adminStartInstagramConnect({ data }: { data: { origin: string } }): Promise<{ url: string }> {
  return invokeVoice("adminStartInstagramConnect", data);
}
export function adminSyncInstagram(): Promise<{ added: number; total: number }> { return invokeVoice("adminSyncInstagram"); }
export function adminDisconnectInstagram(): Promise<{ ok: true }> { return invokeVoice("adminDisconnectInstagram"); }
export function adminSaveInstagramOptions({ data }: { data: {
  show_reels: boolean; show_posts: boolean; show_carousels: boolean; display_count: number;
} }): Promise<{ ok: true }> {
  return invokeVoice("adminSaveInstagramOptions", data);
}
export function finishInstagramOAuth({ data }: { data: { state: string; code: string } }): Promise<{ ok: true; username: string }> {
  return invokeVoice("finishInstagramOAuth", data, { allowAnonymous: true });
}

export {
  listVideos, getPublicChannel, adminGetYoutubeSource, adminSaveYoutubeKey, adminTestYoutubeKey,
  adminSaveYoutubeSource, adminSyncYoutube, adminSyncIfStale, adminListVideos, adminSetVideoStatus,
  adminUpdateVideo, adminAddManualVideo,
} from "@/lib/api/youtube";
export type {
  PublicVideo, AdminVideo, YoutubeSource, YoutubeSyncResult, AdminVideoUpdate, AdminManualVideoInput,
} from "@/lib/api/youtube";
