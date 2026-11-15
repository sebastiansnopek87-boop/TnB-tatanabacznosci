import type { PageDraft, PageSection, PageVersion, PublicPage } from "@/lib/pages";
import { invokeEdge } from "./_invoke";

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

export type AdminPageListItem = {
  id: string;
  slug: string;
  system_key: string | null;
  title: string;
  status: string;
  published_at: string | null;
  updated_at: string;
  draft_updated_at: string | null;
};

export async function getPublicPage(input: { key?: string; slug?: string }): Promise<PublicPage | null> {
  return invokeEdge("tnb-pages", { action: "getPublicPage", data: input });
}

export async function adminListPages(): Promise<AdminPageListItem[]> {
  return invokeEdge("tnb-pages", { action: "adminListPages" });
}

export async function adminGetPage(input: { id: string }): Promise<PublicPage & { draft?: PageDraft | null; draft_updated_at?: string | null }> {
  return invokeEdge("tnb-pages", { action: "adminGetPage", data: input });
}

export async function adminCheckSlug(input: { slug: string; id: string | null }): Promise<{ ok: boolean; reason: string }> {
  return invokeEdge("tnb-pages", { action: "adminCheckSlug", data: input });
}

export async function adminSavePage(input: SavePageInput): Promise<{ id: string }> {
  return invokeEdge("tnb-pages", { action: "adminSavePage", data: input });
}

export async function adminSetPageStatus(input: { id: string; status: "draft" | "published" | "archived" }): Promise<{ ok: true }> {
  return invokeEdge("tnb-pages", { action: "adminSetPageStatus", data: input });
}

export async function adminCreatePageUpload(input: { id: string; type: string; size: number }): Promise<{ path: string; token: string; name: string }> {
  return invokeEdge("tnb-pages", { action: "adminCreatePageUpload", data: input });
}

export async function adminPageImageUrls(input: { id: string; names: string[] }): Promise<Record<string, string>> {
  return invokeEdge("tnb-pages", { action: "adminPageImageUrls", data: input });
}

export async function adminSaveDraft(input: { id: string; draft: PageDraft; version?: boolean }): Promise<{ savedAt: string }> {
  return invokeEdge("tnb-pages", { action: "adminSaveDraft", data: input });
}

export async function adminPublishDraft(input: { id: string; legalConfirmed?: boolean; expectedDigest?: string }): Promise<unknown> {
  return invokeEdge("tnb-pages", { action: "adminPublishDraft", data: input });
}

export async function adminListVersions(input: { id: string }): Promise<PageVersion[]> {
  return invokeEdge("tnb-pages", { action: "adminListVersions", data: input });
}

export async function adminRestoreVersion(input: { id: string; versionId: string }): Promise<{ draft: PageDraft }> {
  return invokeEdge("tnb-pages", { action: "adminRestoreVersion", data: input });
}

export async function adminStartHomeDraft(input: { id: string; draft: PageDraft }): Promise<{ savedAt: string }> {
  return invokeEdge("tnb-pages", { action: "adminStartHomeDraft", data: input });
}
