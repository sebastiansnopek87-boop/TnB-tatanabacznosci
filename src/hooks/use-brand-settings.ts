import { usePlatformSettings } from "./use-platform-settings";

export type Brand = {
  logo?: string;
  favicon?: string;
  og_image?: string;
  header_image?: string;
  header_size?: string;
  site_name?: string;
  slogan?: string;
  show_slogan?: boolean;
  public_title?: string;
  public_description?: string;
  site_url?: string;
};

export function brandSrc(value?: string) {
  return value ? `/api/public/brand/${value.replace(/^brand\//, "")}` : null;
}

export function getBrandSlogan(brand: Brand | null): string | null {
  if (!brand || brand.show_slogan === false) return null;
  return (brand.slogan ?? "Ojcostwo to służba").trim() || null;
}

export function useBrand(): Brand | null {
  const { data } = usePlatformSettings();
  const bs = data?.brand_settings;
  return bs && typeof bs === "object" && !Array.isArray(bs) ? (bs as Brand) : null;
}
