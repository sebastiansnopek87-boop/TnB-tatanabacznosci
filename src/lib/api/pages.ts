import { invokeEdge } from "@/lib/api/edge";
import type { PageDraft, PageSection, PageVersion, PublicPage } from "@/lib/pages";

type DataArg<T> = { data: T };

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

export type AdminPageRecord = AdminPageSummary & {
  intro: string;
  sections: PageSection[];
  seo_title: string;
  seo_description: string;
  draft: PageDraft | null;
};

export type SavePageInput = {
  id: string | null;
  slug: string;
  title: string;
  intro: string;
  sections: PageSection[];
  seo_title: string;
  seo_description: string;
  system_key?: string | null;
};

export function getPublicPage({
  data,
}: DataArg<{ key?: string; slug?: string }>): Promise<PublicPage | null> {
  return invokeEdge("tnb-pages", { action: "getPublicPage", data });
}

export function adminListPages(): Promise<AdminPageSummary[]> {
  return invokeEdge("tnb-pages", { action: "adminListPages" });
}

export function adminGetPage({ data }: DataArg<{ id: string }>): Promise<AdminPageRecord> {
  return invokeEdge("tnb-pages", { action: "adminGetPage", data });
}

export function adminCheckSlug({
  data,
}: DataArg<{ slug: string; id: string | null }>): Promise<{ ok: boolean; reason: string }> {
  return invokeEdge("tnb-pages", { action: "adminCheckSlug", data });
}

export function adminSavePage(data: SavePageInput): Promise<{ id: string }> {
  return invokeEdge("tnb-pages", { action: "adminSavePage", data });
}

export function adminSetPageStatus({
  data,
}: DataArg<{ id: string; status: "draft" | "published" | "archived" }>): Promise<{ ok: true }> {
  return invokeEdge("tnb-pages", { action: "adminSetPageStatus", data });
}

export type PageImageUpload = { path: string; token: string; name: string };

export function adminCreatePageUpload({
  data,
}: DataArg<{ id: string; type: string; size: number }>): Promise<PageImageUpload> {
  return invokeEdge("tnb-pages", { action: "adminCreatePageUpload", data });
}

export function adminPageImageUrls({
  data,
}: DataArg<{ id: string; names: string[] }>): Promise<Record<string, string>> {
  return invokeEdge("tnb-pages", { action: "adminPageImageUrls", data });
}

export function adminSaveDraft({
  data,
}: DataArg<{ id: string; draft: PageDraft; version?: boolean }>): Promise<{ savedAt: string }> {
  return invokeEdge("tnb-pages", { action: "adminSaveDraft", data });
}

export function adminPublishDraft({
  data,
}: DataArg<{ id: string; legalConfirmed?: boolean; expectedDigest?: string }>): Promise<{ ok: true }> {
  return invokeEdge("tnb-pages", { action: "adminPublishDraft", data });
}

export function adminListVersions({ data }: DataArg<{ id: string }>): Promise<PageVersion[]> {
  return invokeEdge("tnb-pages", { action: "adminListVersions", data });
}

export function adminRestoreVersion({
  data,
}: DataArg<{ id: string; versionId: string }>): Promise<{ draft: PageDraft }> {
  return invokeEdge("tnb-pages", { action: "adminRestoreVersion", data });
}

export function adminStartHomeDraft({
  data,
}: DataArg<{ id: string; draft: PageDraft }>): Promise<{ savedAt: string }> {
  return invokeEdge("tnb-pages", { action: "adminStartHomeDraft", data });
}
