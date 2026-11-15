import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { EpisodeDetail, EpisodeMedia, EpAccess, EpStatus, PublicEpisode } from "@/lib/podcast";

type PodcastErrorBody = { message?: unknown };

async function invokePodcast<T>(
  action: string,
  data?: Record<string, unknown>,
  options: { allowAnonymous?: boolean; allowNull?: boolean } = {},
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

  const body = data ? { action, data } : { action };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-podcast", {
    body,
    headers,
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as PodcastErrorBody | null;
      if (typeof payload?.message === "string" && payload.message.trim()) {
        throw new Error(payload.message);
      }
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą podcastu.");
  }

  if (result === null && !options.allowNull) {
    throw new Error("Usługa podcastu zwróciła pustą odpowiedź.");
  }
  return result as T;
}

export function listEpisodes(): Promise<PublicEpisode[]> {
  return invokePodcast("listEpisodes", undefined, { allowAnonymous: true });
}

export function getEpisode({ data }: { data: { slug: string } }): Promise<EpisodeDetail | null> {
  return invokePodcast("getEpisode", data, { allowAnonymous: true, allowNull: true });
}

export function getEpisodeMedia({ data }: { data: { id: string } }): Promise<EpisodeMedia> {
  return invokePodcast("getEpisodeMedia", data, { allowAnonymous: true });
}

export function adminListEpisodes(): Promise<Array<{
  id: string;
  slug: string;
  title: string;
  episode_number: number | null;
  category: string;
  access: EpAccess;
  status: EpStatus;
  featured: boolean;
  sort_order: number;
  published_at: string | null;
  audio_path: string | null;
  external_url: string | null;
  cover_path: string | null;
}>> {
  return invokePodcast("adminListEpisodes");
}

export function adminGetEpisode({ data }: { data: { id: string } }): Promise<Tables<"podcast_episodes">> {
  return invokePodcast("adminGetEpisode", data);
}

export type AdminEpisodeInput = {
  id: string | null;
  slug: string;
  title: string;
  subtitle: string;
  episode_number: number | null;
  summary: string;
  description: string;
  script: string;
  category: string;
  access: EpAccess;
  external_url: string;
  duration_seconds: number | null;
  featured: boolean;
  sort_order: number;
  published_at: string | null;
};

export function adminSaveEpisode({ data }: { data: AdminEpisodeInput }): Promise<{ id: string }> {
  return invokePodcast("adminSaveEpisode", data);
}

export function adminSetEpisodeStatus({
  data,
}: {
  data: { id: string; status: EpStatus };
}): Promise<{ ok: true }> {
  return invokePodcast("adminSetEpisodeStatus", data);
}

export function adminCreateUpload({
  data,
}: {
  data: { id: string; kind: "audio" | "cover"; type: string; size: number };
}): Promise<{ path: string; token: string }> {
  return invokePodcast("adminCreateUpload", data);
}

export function adminAttachFile({
  data,
}: {
  data: { id: string; kind: "audio" | "cover"; path: string; type?: string };
}): Promise<{ ok: true }> {
  return invokePodcast("adminAttachFile", data);
}

export function adminRemoveFile({
  data,
}: {
  data: { id: string; kind: "audio" | "cover" };
}): Promise<{ ok: true }> {
  return invokePodcast("adminRemoveFile", data);
}

export function adminPreviewAudio({ data }: { data: { id: string } }): Promise<{ src: string | null }> {
  return invokePodcast("adminPreviewAudio", data);
}
