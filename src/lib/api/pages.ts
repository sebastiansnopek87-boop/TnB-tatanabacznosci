import { invokeTnbFunction } from "@/lib/api/client";
import type { Database } from "@/integrations/supabase/types";
import type { PageDraft, PageSection, PageVersion, PublicPage } from "@/lib/pages";

export type { PageDraft, PageSection, PageVersion, PublicPage };

type PageRow = Database["public"]["Tables"]["site_pages"]["Row"];

export type AdminPageListItem = Pick<
  PageRow,
  "id" | "slug" | "system_key" | "title" | "status" | "published_at" | "updated_at" | "draft_updated_at"
>;

export type AdminPageRecord = Omit<PageRow, "sections" | "draft"> & {
  sections: PageSection[];
  draft: PageDraft | null;
};

type ServerCall<T> = { data: T };

export function getPublicPage({ data }: ServerCall<{ key?: string; slug?: string }>): Promise<PublicPage | null> {
  return invokeTnbFunction<PublicPage | null>("tnb-pages", {
    action: "getPublicPage",
    data,
  }, { allowNull: true });
}

export function adminListPages(): Promise<AdminPageListItem[]> {
  return invokeTnbFunction<AdminPageListItem[]>("tnb-pages", {
    action: "adminListPages",
  });
}

export function adminGetPage({ data }: ServerCall<{ id: string }>): Promise<AdminPageRecord> {
  return invokeTnbFunction<AdminPageRecord>("tnb-pages", {
    action: "adminGetPage",
    data,
  });
}

export function adminCheckSlug({ data }: ServerCall<{ slug: string; id: string | null }>): Promise<{ ok: boolean; reason: string }> {
  return invokeTnbFunction("tnb-pages", {
    action: "adminCheckSlug",
    data,
  });
}

export type AdminSavePageInput = {
  id: string | null;
  system_key?: string | null;
  slug: string;
  title: string;
  intro: string;
  sections: PageSection[];
  seo_title: string;
  seo_description: string;
};

export function adminSavePage({ data }: ServerCall<AdminSavePageInput>): Promise<{ id: string }> {
  return invokeTnbFunction("tnb-pages", {
    action: "adminSavePage",
    data,
  });
}

export function adminSetPageStatus({ data }: ServerCall<{
  id: string;
  status: "draft" | "published" | "archived";
}>): Promise<{ ok: true }> {
  return invokeTnbFunction("tnb-pages", {
    action: "adminSetPageStatus",
    data,
  });
}

export function adminCreatePageUpload({ data }: ServerCall<{
  id: string;
  type: string;
  size: number;
}>): Promise<{ path: string; token: string; name: string }> {
  return invokeTnbFunction("tnb-pages", {
    action: "adminCreatePageUpload",
    data,
  });
}

export function adminPageImageUrls({ data }: ServerCall<{
  id: string;
  names: string[];
}>): Promise<Record<string, string>> {
  return invokeTnbFunction("tnb-pages", {
    action: "adminPageImageUrls",
    data,
  });
}

export function adminSaveDraft({ data }: ServerCall<{
  id: string;
  draft: PageDraft;
  version?: boolean;
}>): Promise<{ savedAt: string }> {
  return invokeTnbFunction("tnb-pages", {
    action: "adminSaveDraft",
    data: { ...data, version: data.version ?? false },
  });
}

export function adminPublishDraft({ data }: ServerCall<{
  id: string;
  legalConfirmed?: boolean;
  expectedDigest?: string;
}>): Promise<{ ok: true }> {
  return invokeTnbFunction("tnb-pages", {
    action: "adminPublishDraft",
    data,
  });
}

export function adminListVersions({ data }: ServerCall<{ id: string }>): Promise<PageVersion[]> {
  return invokeTnbFunction("tnb-pages", {
    action: "adminListVersions",
    data,
  });
}

export function adminRestoreVersion({ data }: ServerCall<{
  id: string;
  versionId: string;
}>): Promise<{ draft: PageDraft }> {
  return invokeTnbFunction("tnb-pages", {
    action: "adminRestoreVersion",
    data,
  });
}

export function adminStartHomeDraft({ data }: ServerCall<{
  id: string;
  draft: PageDraft;
}>): Promise<{ savedAt: string }> {
  return invokeTnbFunction("tnb-pages", {
    action: "adminStartHomeDraft",
    data,
  });
}
