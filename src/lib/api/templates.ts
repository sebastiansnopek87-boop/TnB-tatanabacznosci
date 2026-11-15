import type { PageSection } from "@/lib/pages";
import { invokeEdge } from "./_invoke";

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

export type TemplateMeta = {
  name: string;
  description: string;
  category: string;
};

export async function adminListTemplates(): Promise<BuilderTemplate[]> {
  return invokeEdge("tnb-templates", { action: "adminListTemplates" });
}

export async function adminCreateTemplate(input: TemplateMeta & {
  pageId: string;
  scope: BuilderTemplate["scope"];
  sections: PageSection[];
}): Promise<{ id: string }> {
  return invokeEdge("tnb-templates", { action: "adminCreateTemplate", data: input });
}

export async function adminUpdateTemplate(input: TemplateMeta & { id: string }): Promise<{ ok: true }> {
  return invokeEdge("tnb-templates", { action: "adminUpdateTemplate", data: input });
}

export async function adminDuplicateTemplate(input: { id: string; name: string }): Promise<{ id: string }> {
  return invokeEdge("tnb-templates", { action: "adminDuplicateTemplate", data: input });
}

export async function adminDeleteTemplate(input: { id: string }): Promise<{ ok: true }> {
  return invokeEdge("tnb-templates", { action: "adminDeleteTemplate", data: input });
}

export async function adminInstantiateTemplate(input: { id: string; pageId: string }): Promise<{ sections: PageSection[] }> {
  return invokeEdge("tnb-templates", { action: "adminInstantiateTemplate", data: input });
}

export async function adminTemplateImageUrls(input: {
  files: { t: string; n: string }[];
}): Promise<Record<string, string>> {
  return invokeEdge("tnb-templates", { action: "adminTemplateImageUrls", data: input });
}
