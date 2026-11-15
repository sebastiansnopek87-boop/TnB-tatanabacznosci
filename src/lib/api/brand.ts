import { invokeTnbFunction } from "@/lib/api/client";

export type BrandSettings = Record<string, string | boolean>;
export type BrandSettingsResult = { settings: BrandSettings; canEdit: boolean };

type ServerCall<T> = { data: T };

export function getBrandSettings(): Promise<BrandSettingsResult> {
  return invokeTnbFunction<BrandSettingsResult>("tnb-brand", {
    action: "getBrandSettings",
  });
}

export function createBrandUpload({ data }: ServerCall<{
  name: string;
  type: string;
  size: number;
}>): Promise<{ path: string; token: string; bucket: string }> {
  return invokeTnbFunction("tnb-brand", {
    action: "createBrandUpload",
    name: data.name,
    type: data.type,
    size: data.size,
  });
}

export function finalizeBrandUpload({ data }: ServerCall<{ path: string }>): Promise<{ ok: true }> {
  return invokeTnbFunction("tnb-brand", {
    action: "finalizeBrandUpload",
    path: data.path,
  });
}

export type SaveBrandSettingsInput = {
  logo: string;
  favicon: string;
  og_image: string;
  header_image: string;
  header_size: string;
  site_name: string;
  public_title: string;
  public_description: string;
  site_url: string;
  slogan: string;
  show_slogan: boolean;
};

export function saveBrandSettings({ data }: ServerCall<SaveBrandSettingsInput>): Promise<{ ok: true }> {
  return invokeTnbFunction("tnb-brand", {
    action: "saveBrandSettings",
    settings: data,
  });
}
