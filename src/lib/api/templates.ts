import { supabase } from "@/integrations/supabase/client";
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

type TemplateMeta = {
  name: string;
  description: string;
  category: string;
};

type EdgeErrorBody = {
  message?: unknown;
};

async function invokeTemplates<T>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error("Nie udało się odczytać sesji. Zaloguj się ponownie.");
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  const { data, error } = await supabase.functions.invoke<T>("tnb-templates", {
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

    throw new Error(error.message || "Nie udało się połączyć z usługą szablonów.");
  }

  if (data === null) {
    throw new Error("Usługa szablonów zwróciła pustą odpowiedź.");
  }

  return data;
}

export async function adminListTemplates(): Promise<BuilderTemplate[]> {
  return invokeTemplates<BuilderTemplate[]>({ action: "adminListTemplates" });
}

export async function adminCreateTemplate({
  data,
}: {
  data: TemplateMeta & {
    pageId: string;
    scope: BuilderTemplate["scope"];
    sections: PageSection[];
  };
}): Promise<{ id: string }> {
  return invokeTemplates<{ id: string }>({ action: "adminCreateTemplate", data });
}

export async function adminUpdateTemplate({
  data,
}: {
  data: TemplateMeta & { id: string };
}): Promise<{ ok: true }> {
  return invokeTemplates<{ ok: true }>({ action: "adminUpdateTemplate", data });
}

export async function adminDuplicateTemplate({
  data,
}: {
  data: { id: string; name: string };
}): Promise<{ id: string }> {
  return invokeTemplates<{ id: string }>({ action: "adminDuplicateTemplate", data });
}

export async function adminDeleteTemplate({
  data,
}: {
  data: { id: string };
}): Promise<{ ok: true }> {
  return invokeTemplates<{ ok: true }>({ action: "adminDeleteTemplate", data });
}

export async function adminInstantiateTemplate({
  data,
}: {
  data: { id: string; pageId: string };
}): Promise<{ sections: PageSection[] }> {
  return invokeTemplates<{ sections: PageSection[] }>({ action: "adminInstantiateTemplate", data });
}

export async function adminTemplateImageUrls({
  data,
}: {
  data: { files: Array<{ t: string; n: string }> };
}): Promise<Record<string, string>> {
  return invokeTemplates<Record<string, string>>({ action: "adminTemplateImageUrls", data });
}
