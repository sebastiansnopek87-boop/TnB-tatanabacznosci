import { supabase } from "@/integrations/supabase/client";
import { publicAvatarUrl } from "@/lib/public-assets";
export { saveMyAvatar, removeMyAvatar } from "@/lib/avatar.functions";

export async function getMyAvatar(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error("Nie udało się odczytać sesji użytkownika.");
  return data.user ? publicAvatarUrl("own", data.user.id) : null;
}
