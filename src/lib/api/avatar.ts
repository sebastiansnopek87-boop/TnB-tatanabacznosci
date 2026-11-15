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
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error("Nie udało się odczytać sesji użytkownika.");
  if (!data.user) return null;

  const userId = data.user.id;
  const { data: avatar, error } = await supabase
    .from("user_avatars")
    .select("object_path")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("Nie udało się wczytać avatara.");

  const objectPath = avatar?.object_path;
  if (typeof objectPath !== "string" || !objectPath.startsWith(`avatars/${userId}/`)) return null;

  const version = objectPath.split("/").pop();
  return publicAvatarUrl("own", userId, version);
}
