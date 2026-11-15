import { supabase } from "@/integrations/supabase/client";

export type BrandSettings = Record<string, string | boolean>;
export type BrandSettingsInput = {
  logo: string;
  favicon: string;
  og_image: string;
  header_image: string;
  header_size: string;
  site_name: string;
  slogan: string;
  show_slogan: boolean;
  public_title: string;
  public_description: string;
  site_url: string;
};
export type BrandSettingsResponse = { settings: BrandSettings; canEdit: boolean };
export type BrandUpload = { path: string; token: string; bucket: string };

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("tnb-brand", { body });
  if (error) {
    let message = error.message || "Nie udało się wykonać operacji.";
    const context = (error as Error & { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      try {
        const payload = await context.clone().json() as { message?: unknown };
        if (typeof payload.message === "string" && payload.message.trim()) message = payload.message;
      } catch {
        // Keep the SDK fallback when the response is not JSON.
      }
    }
    throw new Error(message);
  }
  if (data == null) throw new Error("Serwer zwrócił pustą odpowiedź.");
  return data;
}

export function getBrandSettings(): Promise<BrandSettingsResponse> {
  return invoke<BrandSettingsResponse>({ action: "getBrandSettings" });
}

export function createBrandUpload(input: { data: { name: string; type: string; size: number } }): Promise<BrandUpload> {
  return invoke<BrandUpload>({ action: "createBrandUpload", ...input.data });
}

export function finalizeBrandUpload(input: { data: { path: string } }): Promise<{ ok: true }> {
  return invoke<{ ok: true }>({ action: "finalizeBrandUpload", ...input.data });
}

export function saveBrandSettings(input: { data: BrandSettingsInput }): Promise<{ ok: true }> {
  return invoke<{ ok: true }>({ action: "saveBrandSettings", settings: input.data });
}

export function brandImageUrl(value?: string): string | null {
  if (!value) return null;
  const file = value.replace(/^brand\//, "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|ico)$/.test(file)) return null;
  const base = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  if (!base) return null;
  return base.replace(/\/$/, "") + "/functions/v1/tnb-brand?file=" + encodeURIComponent(file);
}
