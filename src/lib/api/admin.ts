import { supabase } from "@/integrations/supabase/client";

// The navigation guard only needs the current user's role; the database RPC
// is already authenticated and does not expose privileged dashboard data.
export * from "@/lib/admin.functions";

export async function getAdminStatus(): Promise<{ isAdmin: boolean; email: string | null }> {
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (roleError) throw new Error("Nie udało się sprawdzić uprawnień administratora.");
  return { isAdmin: !!isAdmin, email: user.email ?? null };
}
