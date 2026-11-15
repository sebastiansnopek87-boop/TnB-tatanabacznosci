import { supabase } from "@/integrations/supabase/client";

export type MediaBucket =
  | "library-files"
  | "podcast-files"
  | "meeting-images"
  | "page-images"
  | "media";

export type MediaKind = "image" | "audio" | "document" | "other";
export type MediaModule = "library" | "podcast" | "meetings" | "pages" | "unknown";
export type MediaSort = "date_desc" | "date_asc" | "name_asc" | "name_desc";

export type MediaUsage = {
  module: string;
  label: string;
  title: string;
  status: string;
  published: boolean;
};

export type MediaRow = {
  bucket: MediaBucket;
  path: string;
  file: string;
  format: string;
  mime: string;
  size: number;
  created_at: string;
  kind: MediaKind;
  module: MediaModule;
  usages: MediaUsage[];
};

export type MediaListInput = {
  q: string;
  kind: "" | MediaKind;
  module: "" | MediaModule;
  sort: MediaSort;
  page: number;
};

export type MediaListResult = {
  rows: MediaRow[];
  total: number;
  pageSize: number;
};

export type MediaTarget = {
  bucket: MediaBucket;
  path: string;
};

export type MediaDetail = MediaRow & {
  preview: string | null;
  deletable: boolean;
};

export type MediaUpload = {
  path: string;
  token: string;
  bucket: "media";
};

type EdgeErrorBody = { message?: unknown };

async function invokeMedia<T>(action: string, data: Record<string, unknown>): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error("Nie udało się odczytać sesji. Zaloguj się ponownie.");
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  const { data: result, error } = await supabase.functions.invoke<T>("tnb-media-admin", {
    body: { action, data },
    headers: { Authorization: "Bearer " + accessToken },
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as EdgeErrorBody | null;
      if (typeof payload?.message === "string" && payload.message.trim()) {
        throw new Error(payload.message);
      }
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą multimediów.");
  }

  if (result === null) {
    throw new Error("Usługa multimediów zwróciła pustą odpowiedź.");
  }
  return result;
}

export function listMedia({ data }: { data: MediaListInput }): Promise<MediaListResult> {
  return invokeMedia<MediaListResult>("listMedia", data);
}

export function getMediaDetail({ data }: { data: MediaTarget }): Promise<MediaDetail> {
  return invokeMedia<MediaDetail>("getMediaDetail", data);
}

export function createMediaUpload({
  data,
}: {
  data: { name: string; type: string; size: number };
}): Promise<MediaUpload> {
  return invokeMedia<MediaUpload>("createMediaUpload", data);
}

export function finalizeMediaUpload({
  data,
}: {
  data: { path: string };
}): Promise<{ ok: true }> {
  return invokeMedia<{ ok: true }>("finalizeMediaUpload", data);
}

export function deleteMedia({ data }: { data: MediaTarget }): Promise<{ ok: true }> {
  return invokeMedia<{ ok: true }>("deleteMedia", data);
}
