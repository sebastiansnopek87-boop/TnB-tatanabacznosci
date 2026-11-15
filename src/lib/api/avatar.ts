import { supabase } from "@/integrations/supabase/client";
import { publicAvatarUrl } from "@/lib/public-assets";

type AvatarResponse = {
  ok?: unknown;
  message?: unknown;
};

async function invokeAvatar(action: "save" | "remove", image?: Blob): Promise<{ ok: true }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error("Nie udało się odczytać sesji użytkownika.");
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  const options = {
    method: "POST" as const,
    headers: {
      Authorization: "Bearer " + accessToken,
      ...(image ? { "Content-Type": "image/webp" } : {}),
    },
    ...(image ? { body: image } : {}),
  };

  const { data, error } = await supabase.functions.invoke<AvatarResponse>(
    "tnb-avatar?action=" + action,
    options,
  );

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as AvatarResponse | null;
      if (typeof payload?.message === "string" && payload.message.trim()) {
        throw new Error(payload.message);
      }
    }
    throw new Error(error.message || "Nie udało się wykonać operacji na avatarze.");
  }

  if (!data || data.ok !== true) {
    throw new Error(
      typeof data?.message === "string" && data.message.trim()
        ? data.message
        : "Nie udało się wykonać operacji na avatarze.",
    );
  }

  return { ok: true };
}

export async function saveMyAvatar({ data }: { data: FormData }): Promise<{ ok: true }> {
  const image = data.get("image");
  if (!(image instanceof Blob) || image.type !== "image/webp" || image.size === 0) {
    throw new Error("Nieprawidłowy obraz avatara.");
  }
  return invokeAvatar("save", image);
}

export async function removeMyAvatar(): Promise<{ ok: true }> {
  return invokeAvatar("remove");
}

export async function getMyAvatar(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error("Nie udało się odczytać sesji użytkownika.");
  return data.user ? publicAvatarUrl("own", data.user.id) : null;
}
