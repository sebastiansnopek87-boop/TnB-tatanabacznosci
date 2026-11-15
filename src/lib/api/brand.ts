import { supabase } from "@/integrations/supabase/client";

export type BrandSettings = Record<string, string | boolean>;

export type BrandSettingsResult = {
  settings: BrandSettings;
  canEdit: boolean;
};

type SaveBrandSettingsInput = {
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

type EdgeErrorBody = {
  message?: unknown;
};

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
      const payload = (await context.clone().json().catch(() => null)) as EdgeErrorBody | null;
      if (typeof payload?.message === "string" && payload.message.trim()) {
        throw new Error(payload.message);
      }
    }

    throw new Error(error.message || "Nie udało się połączyć z usługą marki.");
  }

  if (data === null) {
    throw new Error("Usługa marki zwróciła pustą odpowiedź.");
  }

  return data;
}

export async function getBrandSettings(): Promise<BrandSettingsResult> {
  return invokeBrand<BrandSettingsResult>({ action: "getBrandSettings" });
}

export async function createBrandUpload({
  data,
}: {
  data: { name: string; type: string; size: number };
}): Promise<{ path: string; token: string; bucket: string }> {
  return invokeBrand<{ path: string; token: string; bucket: string }>({
    action: "createBrandUpload",
    ...data,
  });
}

export async function finalizeBrandUpload({
  data,
}: {
  data: { path: string };
}): Promise<{ ok: true }> {
  return invokeBrand<{ ok: true }>({ action: "finalizeBrandUpload", ...data });
}

export async function saveBrandSettings({
  data,
}: {
  data: SaveBrandSettingsInput;
}): Promise<{ ok: true }> {
  return invokeBrand<{ ok: true }>({ action: "saveBrandSettings", settings: data });
}
