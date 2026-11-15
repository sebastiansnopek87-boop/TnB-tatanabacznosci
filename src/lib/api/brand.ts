import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const BUCKET = "media";
const FILE_RE = /^brand\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|ico)$/;

export type BrandSettings = Record<string, string | boolean>;

type EdgeErrorBody = {
  message?: unknown;
  error?: unknown;
};

type BrandUpload = { path: string; token: string; bucket: string };

async function invokeBrand<T>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error("Nie udało się odczytać sesji. Zaloguj się ponownie.");
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  const { data, error } = await supabase.functions.invoke<T>("tnb-brand", {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      try {
        const payload = (await context.clone().json()) as EdgeErrorBody;
        if (typeof payload.message === "string" && payload.message.trim()) {
          throw new Error(payload.message);
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== "Unexpected end of JSON input") {
          throw parseError;
        }
      }
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą ustawień marki.");
  }

  if (data === null) {
    throw new Error("Usługa ustawień marki zwróciła pustą odpowiedź.");
  }

  return data;
}

export function brandImageUrl(value?: string): string | null {
  if (!value) return null;
  const file = value.replace(/^brand\//, "");
  const base = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").replace(/\/+$/, "");
  return base
    ? `${base}/functions/v1/tnb-brand?file=${encodeURIComponent(file)}`
    : `/api/public/brand/${encodeURIComponent(file)}`;
}

export const getBrandSettings = (): Promise<{ settings: BrandSettings; canEdit: boolean }> =>
  invokeBrand({ action: "getBrandSettings" });

export const createBrandUpload = ({ data }: { data: { name: string; type: string; size: number } }): Promise<BrandUpload> =>
  invokeBrand({ action: "createBrandUpload", ...data });

export const finalizeBrandUpload = ({ data }: { data: { path: string } }): Promise<{ ok: true }> =>
  invokeBrand({ action: "finalizeBrandUpload", ...data });

const optFile = z.union([z.string().regex(FILE_RE, "Nieprawidłowa referencja pliku marki."), z.literal("")]).transform((v) => (v === "" ? undefined : v));
const optSize = z.union([z.enum(["small", "medium", "large", "very_large"]), z.literal("")]).transform((v) => (v === "" ? undefined : v));
const optText = (max: number) => z.union([z.string().trim().min(1, "Pole nie może być puste").max(max), z.literal("")]).transform((v) => (v === "" ? undefined : v));
const optUrl = z.union([
  z.string().trim().max(500).regex(/^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(\/[A-Za-z0-9._~/-]*)?$/, "Podaj poprawny publiczny adres zaczynający się od https://"),
  z.literal(""),
]).transform((v) => (v === "" ? undefined : v));

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

export const saveBrandSettings = ({ data }: { data: z.infer<typeof brandSchema> }): Promise<{ ok: true }> =>
  invokeBrand({ action: "saveBrandSettings", settings: data });
