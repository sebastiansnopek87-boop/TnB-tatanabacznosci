import { invokeEdge } from "@/lib/api/edge";
import type { BuilderTemplate } from "@/lib/templates.functions";

type DataArg<T> = { data: T };

export type { BuilderTemplate };

export function adminListTemplates(): Promise<BuilderTemplate[]> {
  return invokeEdge("tnb-templates", { action: "adminListTemplates" });
}

export function adminCreateTemplate({ data }: DataArg<unknown>): Promise<{ id: string }> {
  return invokeEdge("tnb-templates", { action: "adminCreateTemplate", data });
}

export function adminUpdateTemplate({ data }: DataArg<unknown>): Promise<{ ok: true }> {
  return invokeEdge("tnb-templates", { action: "adminUpdateTemplate", data });
}

export function adminDuplicateTemplate({
  data,
}: DataArg<{ id: string; name: string }>): Promise<{ id: string }> {
  return invokeEdge("tnb-templates", { action: "adminDuplicateTemplate", data });
}

export function adminDeleteTemplate({ data }: DataArg<{ id: string }>): Promise<{ ok: true }> {
  return invokeEdge("tnb-templates", { action: "adminDeleteTemplate", data });
}

export function adminInstantiateTemplate({
  data,
}: DataArg<{ id: string; pageId: string }>): Promise<{ id: string }> {
  return invokeEdge("tnb-templates", { action: "adminInstantiateTemplate", data });
}

export function adminTemplateImageUrls({
  data,
}: DataArg<{ files: Array<{ t: string; n: string }> }>): Promise<Record<string, string>> {
  return invokeEdge("tnb-templates", { action: "adminTemplateImageUrls", data });
}
