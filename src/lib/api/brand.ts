import { invokeEdge } from "@/lib/api/edge";
import type { BrandSettings } from "@/lib/brand.functions";

type DataArg<T> = { data: T };

export function getBrandSettings(): Promise<{ settings: BrandSettings; canEdit: boolean }> {
  return invokeEdge("tnb-brand", { action: "getBrandSettings" });
}

export function createBrandUpload({ data }: DataArg<{ name: string; type: string; size: number }>): Promise<any> {
  return invokeEdge("tnb-brand", { action: "createBrandUpload", ...data });
}

export function finalizeBrandUpload({ data }: DataArg<{ path: string }>): Promise<any> {
  return invokeEdge("tnb-brand", { action: "finalizeBrandUpload", ...data });
}

export function saveBrandSettings({ data }: DataArg<BrandSettings>): Promise<{ ok: true }> {
  return invokeEdge("tnb-brand", { action: "saveBrandSettings", settings: data });
}
