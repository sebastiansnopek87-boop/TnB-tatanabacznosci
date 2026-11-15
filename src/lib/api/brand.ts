import { z } from "zod";
import { invokeEdge } from "./_invoke";

const FILE_RE = /^brand\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|ico)$/;
const optFile = z.union([z.string().regex(FILE_RE, "Nieprawidłowa referencja pliku marki."), z.literal("")]).transform((v) => v === "" ? undefined : v);
const optSize = z.union([z.enum(["small", "medium", "large", "very_large"]), z.literal("")]).transform((v) => v === "" ? undefined : v);
const optText = (max: number) => z.union([z.string().trim().min(1, "Pole nie może być puste").max(max), z.literal("")]).transform((v) => v === "" ? undefined : v);
const optUrl = z.union([
  z.string().trim().max(500).regex(/^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(\/[A-Za-z0-9._~/-]*)?$/, "Podaj poprawny publiczny adres zaczynający się od https://"),
  z.literal(""),
]).transform((v) => v === "" ? undefined : v);

export type BrandSettings = Record<string, string | boolean>;

export const brandSchema = z.object({
  logo: optFile,
  favicon: optFile,
  og_image: optFile,
  header_image: optFile,
  header_size: optSize,
  site_name: optText(200),
  slogan: z.string().trim().max(200).optional(),
  show_slogan: z.boolean().optional(),
  public_title: optText(200),
  public_description: optText(2000),
  site_url: optUrl,
}).strict();

export type BrandSettingsInput = z.infer<typeof brandSchema>;

export async function getBrandSettings(): Promise<{ settings: BrandSettings; canEdit: boolean }> {
  return invokeEdge("tnb-brand", { action: "getBrandSettings" });
}

export async function createBrandUpload(input: { name: string; type: string; size: number }): Promise<{ path: string; token: string; bucket: string }> {
  return invokeEdge("tnb-brand", { action: "createBrandUpload", ...input });
}

export async function finalizeBrandUpload(input: { path: string }): Promise<{ ok: true }> {
  return invokeEdge("tnb-brand", { action: "finalizeBrandUpload", path: input.path });
}

export async function saveBrandSettings(input: BrandSettingsInput): Promise<{ ok: true }> {
  const settings = brandSchema.parse(input);
  return invokeEdge("tnb-brand", { action: "saveBrandSettings", settings });
}
