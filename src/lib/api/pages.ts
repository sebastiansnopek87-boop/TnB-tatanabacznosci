import { supabase } from "@/integrations/supabase/client";
import type { PageDraft, PageSection, PageVersion, PublicPage } from "@/lib/pages";

export type AdminPageSummary = {
  id: string;
  slug: string;
  system_key: string | null;
  title: string;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  updated_at: string;
  draft_updated_at: string | null;
};

export type AdminPageRecord = {
  id: string;
  slug: string;
  system_key: string | null;
  title: string;
  intro: string;
  sections: PageSection[];
  seo_title: string;
  seo_description: string;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  updated_at: string;
  created_at: string;
  created_by: string | null;
  draft: PageDraft | null;
  draft_updated_at: string | null;
};

export type SavePageInput = {
  id: string | null;
  system_key?: string | null;
  slug: string;
  title: string;
  intro: string;
  sections: PageSection[];
  seo_title: string;
  seo_description: string;
};

type PageStatus = "draft" | "published" | "archived";
type EdgeErrorBody = { message?: unknown; error?: unknown };

async function invokePages<T>(
  body: Record<string, unknown>,
  options: { authenticated?: boolean; allowNull?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};

  if (options.authenticated !== false) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error("Nie udało się odczytać sesji. Zaloguj się ponownie.");
    }

    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error("Sesja wygasła. Zaloguj się ponownie.");
    }

    headers.Authorization = `Bearer ${accessToken}`;
  }

  const { data, error } = await supabase.functions.invoke<T>("tnb-pages", {
    body,
    headers,
  });

  if (error) {
    const context = (error as { context?: unknown }).context;

    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as EdgeErrorBody | null;
      if (typeof payload?.message === "string" && payload.message.trim()) {
        throw new Error(payload.message);
      }
    }

    throw new Error(error.message || "Nie udało się połączyć z usługą stron.");
  }

  if (data === null && !options.allowNull) {
    throw new Error("Usługa stron zwróciła pustą odpowiedź.");
  }

  return data as T;
}

export function getPublicPage({
  data,
}: {
  data: { key?: string; slug?: string };
}): Promise<PublicPage | null> {
  return invokePages<PublicPage | null>(
    { action: "getPublicPage", data },
    { authenticated: false, allowNull: true },
  );
}

export function adminListPages(): Promise<AdminPageSummary[]> {
  return invokePages<AdminPageSummary[]>({ action: "adminListPages" });
}

export function adminGetPage({
  data,
}: {
  data: { id: string };
}): Promise<AdminPageRecord> {
  return invokePages<AdminPageRecord>({ action: "adminGetPage", data });
}

export function adminCheckSlug({
  data,
}: {
  data: { slug: string; id: string | null };
}): Promise<{ ok: boolean; reason: string }> {
  return invokePages({ action: "adminCheckSlug", data });
}

export function adminSavePage({
  data,
}: {
  data: SavePageInput;
}): Promise<{ id: string }> {
  return invokePages({ action: "adminSavePage", data });
}

export function adminSetPageStatus({
  data,
}: {
  data: { id: string; status: PageStatus };
}): Promise<{ ok: true }> {
  return invokePages({ action: "adminSetPageStatus", data });
}

export function adminCreatePageUpload({
  data,
}: {
  data: { id: string; type: string; size: number };
}): Promise<{ path: string; token: string; name: string }> {
  return invokePages({ action: "adminCreatePageUpload", data });
}

export function adminPageImageUrls({
  data,
}: {
  data: { id: string; names: string[] };
}): Promise<Record<string, string>> {
  return invokePages({ action: "adminPageImageUrls", data });
}

export function adminSaveDraft({
  data,
}: {
  data: { id: string; draft: PageDraft; version?: boolean };
}): Promise<{ savedAt: string }> {
  return invokePages({ action: "adminSaveDraft", data });
}

export function adminPublishDraft({
  data,
}: {
  data: { id: string; legalConfirmed?: boolean; expectedDigest?: string };
}): Promise<{ ok: true }> {
  return invokePages({ action: "adminPublishDraft", data });
}

export function adminListVersions({
  data,
}: {
  data: { id: string };
}): Promise<PageVersion[]> {
  return invokePages({ action: "adminListVersions", data });
}

export function adminRestoreVersion({
  data,
}: {
  data: { id: string; versionId: string };
}): Promise<{ draft: PageDraft }> {
  return invokePages({ action: "adminRestoreVersion", data });
}

export function adminStartHomeDraft({
  data,
}: {
  data: { id: string; draft: PageDraft };
}): Promise<{ savedAt: string }> {
  return invokePages({ action: "adminStartHomeDraft", data });
}
