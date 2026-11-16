import { supabaseAdmin } from "./compat.ts";
export async function requireSuperadminEdge(req: Request) {
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw Object.assign(new Error("Sesja wygasła. Zaloguj się ponownie."), { status: 401 });
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error("Sesja wygasła. Zaloguj się ponownie."), { status: 401 });
  const { data: admin, error: adminError } = await supabaseAdmin.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  if (adminError || !admin) throw Object.assign(new Error("Brak uprawnień administratora."), { status: 403 });
  const { data: superadmin, error: superError } = await supabaseAdmin.rpc("has_role", { _user_id: data.user.id, _role: "superadmin" });
  if (superError || !superadmin) throw Object.assign(new Error("Tę operację może wykonać tylko superadministrator."), { status: 403 });
  return { userId: data.user.id };
}
