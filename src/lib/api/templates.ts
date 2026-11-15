import { invokeTnbFunction } from "@/lib/api/client";
import type { PageSection } from "@/lib/pages";

export type BuilderTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  scope: "element" | "section" | "sections";
  sections: PageSection[];
  created_at: string;
  updated_at: string;
};

type ServerCall<T> = { data: T };
type TemplateMeta = { name: string; description: string; category: string };

export function adminListTemplates(): Promise<BuilderTemplate[]> {
  return invokeTnbFunction("tnb-templates", {
    action: "adminListTemplates",
  });
}

export function adminCreateTemplate({ data }: ServerCall<TemplateMeta & {
  pageId: string;
  scope: BuilderTemplate["scope"];
  sections: PageSection[];
}>): Promise<{ id: string }> {
  return invokeTnbFunction("tnb-templates", {
    action: "adminCreateTemplate",
    data,
  });
}

export function adminUpdateTemplate({ data }: ServerCall<TemplateMeta & {
  id: string;
}>): Promise<{ ok: true }> {
  return invokeTnbFunction("tnb-templates", {
    action: "adminUpdateTemplate",
    data,
  });
}

export function adminDuplicateTemplate({ data }: ServerCall<{
  id: string;
  name: string;
}>): Promise<{ id: string }> {
  return invokeTnbFunction("tnb-templates", {
    action: "adminDuplicateTemplate",
    data,
  });
}

export function adminDeleteTemplate({ data }: ServerCall<{ id: string }>): Promise<{ ok: true }> {
  return invokeTnbFunction("tnb-templates", {
    action: "adminDeleteTemplate",
    data,
  });
}

export function adminInstantiateTemplate({ data }: ServerCall<{
  id: string;
  pageId: string;
}>): Promise<{ sections: PageSection[] }> {
  return invokeTnbFunction("tnb-templates", {
    action: "adminInstantiateTemplate",
    data,
  });
}

export function adminTemplateImageUrls({ data }: ServerCall<{
  files: Array<{ t: string; n: string }>;
}>): Promise<Record<string, string>> {
  return invokeTnbFunction("tnb-templates", {
    action: "adminTemplateImageUrls",
    data,
  });
}
