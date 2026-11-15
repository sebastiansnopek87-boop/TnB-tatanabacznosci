import { supabase } from "@/integrations/supabase/client";
import { publicAvatarUrl } from "@/lib/public-assets";
export { saveMyAvatar, removeMyAvatar } from "@/lib/avatar.functions";

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
