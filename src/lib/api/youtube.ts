import { supabase } from "@/integrations/supabase/client";

export type PublicVideo = {
  id: string;
  youtube_id: string | null;
  external_url: string | null;
  title: string;
  description: string;
  published_on: string | null;
  published_at: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  source: "manual" | "youtube";
  category: string | null;
  featured: boolean;
};

export type AdminVideo = PublicVideo & {
  status: "draft" | "published" | "hidden";
  synced_at: string | null;
  sort_order: number;
  is_custom_title: boolean;
  is_custom_description: boolean;
  custom_thumbnail_url: string | null;
  archived_at: string | null;
  yt_thumbnail_url: string | null;
};

export type YoutubeSource = {
  id: number;
  channel_input: string | null;
  channel_id: string | null;
  channel_title: string | null;
  channel_thumb: string | null;
  channel_url: string | null;
  uploads_playlist: string | null;
  status: string;
  last_error: string | null;
  last_attempt_at: string | null;
  last_sync_at: string | null;
  last_sync_added: number;
  last_sync_updated: number;
  last_sync_skipped: number;
  last_sync_report: Record<string, unknown> | null;
  video_count: number;
  updated_at: string;
  updated_by: string | null;
  keyConfigured: boolean;
  keyCheck: { length: number; hasWhitespace: boolean; startsAIza: boolean; lengthOk: boolean };
  keyMasked: string;
  keySource: "panel" | "env" | null;
};

export type YoutubeSyncResult = {
  added: number;
  updated: number;
  skipped: number;
  keptCustom: number;
  errors: number;
  total: number;
  fetched: number;
};

type ApiError = { message?: unknown };

async function invokeYoutube<T>(
  action: string,
  data?: Record<string, unknown>,
  options: { allowAnonymous?: boolean } = {},
): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError && !options.allowAnonymous) {
    throw new Error("Nie udało się odczytać sesji. Zaloguj się ponownie.");
  }
  if (!accessToken && !options.allowAnonymous) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = "Bearer " + accessToken;
  const body = data === undefined ? { action } : { action, data };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-youtube", {
    body,
    headers,
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) {
        throw new Error(payload.message);
      }
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą YouTube.");
  }
  if (result === null) throw new Error("Usługa YouTube zwróciła pustą odpowiedź.");
  return result as T;
}

export function listVideos(): Promise<PublicVideo[]> {
  return invokeYoutube<PublicVideo[]>("listVideos", undefined, { allowAnonymous: true });
}

export function getPublicChannel(): Promise<{ url: string | null; title: string | null }> {
  return invokeYoutube<{ url: string | null; title: string | null }>("getPublicChannel", undefined, { allowAnonymous: true });
}

export function adminGetYoutubeSource(): Promise<YoutubeSource> {
  return invokeYoutube<YoutubeSource>("adminGetYoutubeSource");
}

export function adminSaveYoutubeKey({ data }: { data: { key: string } }): Promise<
  { ok: true; masked: string } | { ok: false; error: string }
> {
  return invokeYoutube<{ ok: true; masked: string } | { ok: false; error: string }>("adminSaveYoutubeKey", data);
}

export function adminTestYoutubeKey(): Promise<{ ok: true } | { ok: false; error: string }> {
  return invokeYoutube<{ ok: true } | { ok: false; error: string }>("adminTestYoutubeKey");
}

export function adminSaveYoutubeSource({ data }: { data: { input: string } }): Promise<{
  channel_id: string;
  channel_title: string;
  channel_thumb: string | null;
  channel_url: string;
  uploads_playlist: string;
}> {
  return invokeYoutube<{ channel_id: string; channel_title: string; channel_thumb: string | null; channel_url: string; uploads_playlist: string }>("adminSaveYoutubeSource", data);
}

export function adminSyncYoutube(): Promise<YoutubeSyncResult> {
  return invokeYoutube<YoutubeSyncResult>("adminSyncYoutube");
}

export function adminSyncIfStale(): Promise<{ ok: true }> {
  return invokeYoutube<{ ok: true }>("adminSyncIfStale");
}

export function adminListVideos(): Promise<AdminVideo[]> {
  return invokeYoutube<AdminVideo[]>("adminListVideos");
}

export function adminSetVideoStatus({
  data,
}: {
  data: { id: string; status: "draft" | "published" | "hidden" | "archived" };
}): Promise<{ ok: true }> {
  return invokeYoutube<{ ok: true }>("adminSetVideoStatus", data);
}

export type AdminVideoUpdate = {
  id: string;
  title: string;
  description: string;
  custom_thumbnail_url: string;
  category: string;
  featured: boolean;
  sort_order: number;
  published_on: string;
  reset_title: boolean;
  reset_description: boolean;
};

export function adminUpdateVideo({ data }: { data: AdminVideoUpdate }): Promise<{ ok: true }> {
  return invokeYoutube<{ ok: true }>("adminUpdateVideo", data);
}

export type AdminManualVideoInput = {
  url: string;
  title: string;
  description: string;
  custom_thumbnail_url: string;
  category: string;
  published_on: string;
  status: "draft" | "published";
};

export function adminAddManualVideo({ data }: { data: AdminManualVideoInput }): Promise<{ id: string }> {
  return invokeYoutube<{ id: string }>("adminAddManualVideo", data);
}
