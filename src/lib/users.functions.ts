import { assertAdmin, logEvent } from "./admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ROLE_VALUES = ["superadmin", "admin", "moderator", "editor", "support", "premium"] as const;
type Role = (typeof ROLE_VALUES)[number];
const PER = 25;

type AuthUser = { id: string; email?: string | undefined; created_at: string; email_confirmed_at?: string | undefined | null; last_sign_in_at?: string | undefined | null; banned_until?: string | undefined | null; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
function shape(u: AuthUser, roles: string[]) {
  const m = u.user_metadata ?? {};
  const first = str(m["first_name"]), last = str(m["last_name"]);
  return {
    id: u.id, email: u.email ?? null, created_at: u.created_at,
    confirmed: !!u.email_confirmed_at, last_sign_in_at: u.last_sign_in_at ?? null,
    banned: !!(u.banned_until && new Date(u.banned_until) > new Date()),
    name: [first, last].filter(Boolean).join(" ") || str(m["full_name"]) || str(m["name"]),
    nick: str(m["nick"]), roles,
  };
}
export type AdminUser = ReturnType<typeof shape>;

async function rolesFor(ids: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const map = new Map<string, string[]>();
  if (!ids.length) return map;
  const { data } = await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids);
  for (const r of data ?? []) map.set(r.user_id, [...(map.get(r.user_id) ?? []), r.role]);
  return map;
}

async function isSuperadmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "superadmin" });
  return !!data;
}

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    q: z.string().trim().max(100).default(""),
    role: z.enum(["", "none", ...ROLE_VALUES]).default(""),
    status: z.enum(["", "confirmed", "unconfirmed"]).default(""),
    page: z.number().int().min(0).max(1000).default(0),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const filtered = !!(data.q || data.role || data.status);
    if (!filtered) {
      // Plain browsing: fetch exactly one page from the auth service.
      const { data: res, error } = await supabaseAdmin.auth.admin.listUsers({ page: data.page + 1, perPage: PER });
      if (error) throw new Error("Nie udało się pobrać użytkowników.");
      const rm = await rolesFor(res.users.map((u) => u.id));
      const total = (res as { total?: number }).total ?? res.users.length;
      return { rows: res.users.map((u) => shape(u as AuthUser, rm.get(u.id) ?? [])), total, pageSize: PER, canManage: await isSuperadmin(context) };
    }
    // Filtering: scan in batches of 1000 (auth service has no server-side search), capped at 20k accounts.
    const q = data.q.toLowerCase();
    const matches: AdminUser[] = [];
    for (let p = 1; p <= 20; p++) {
      const { data: res, error } = await supabaseAdmin.auth.admin.listUsers({ page: p, perPage: 1000 });
      if (error) throw new Error("Nie udało się pobrać użytkowników.");
      const rm = await rolesFor(res.users.map((u) => u.id));
      for (const u of res.users) {
        const s = shape(u as AuthUser, rm.get(u.id) ?? []);
        if (q && ![s.email, s.name, s.nick].some((v) => v?.toLowerCase().includes(q))) continue;
        if (data.status === "confirmed" && !s.confirmed) continue;
        if (data.status === "unconfirmed" && s.confirmed) continue;
        if (data.role === "none" ? s.roles.length > 0 : data.role && !s.roles.includes(data.role)) continue;
        matches.push(s);
      }
      if (res.users.length < 1000) break;
    }
    return { rows: matches.slice(data.page * PER, data.page * PER + PER), total: matches.length, pageSize: PER, canManage: await isSuperadmin(context) };
  });

export const getUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.auth.admin.getUserById(data.id);
    if (error || !res.user) throw new Error("Nie znaleziono użytkownika.");
    const rm = await rolesFor([data.id]);
    const u = res.user as AuthUser;
    const providers = (u.app_metadata?.["providers"] as string[] | undefined) ?? [];
    return { ...shape(u, rm.get(u.id) ?? []), providers, isSelf: u.id === context.userId, canManage: await isSuperadmin(context) };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), role: z.enum(ROLE_VALUES), grant: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const type = data.grant ? "role_granted" : "role_revoked";
    const base = { type, actor: context.userId, objectKind: "user", objectId: data.id, detail: `role=${data.role}` };
    if (!(await isSuperadmin(context))) {
      await logEvent({ ...base, result: "denied" });
      throw new Error("Tylko superadministrator może zmieniać role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.id);
    const has = new Set((current ?? []).map((r) => r.role as Role));
    const fail = async (msg: string) => { await logEvent({ ...base, result: "denied", detail: `${base.detail}; ${msg}` }); throw new Error(msg); };

    if (data.grant) {
      if (has.has(data.role)) return { ok: true };
      if (data.role === "superadmin" && !has.has("admin")) await fail("Najpierw nadaj rolę Administrator.");
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role });
      await logEvent({ ...base, result: error ? "failed" : "ok" });
      if (error) throw new Error("Nie udało się nadać roli.");
    } else {
      if (!has.has(data.role)) return { ok: true };
      if (data.role === "admin" && has.has("superadmin")) await fail("Najpierw odbierz rolę Superadministrator.");
      if (data.role === "superadmin") {
        const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "superadmin");
        if ((count ?? 0) <= 1) await fail("Nie można odebrać roli ostatniemu superadministratorowi.");
      }
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id).eq("role", data.role);
      await logEvent({ ...base, result: error ? "failed" : "ok" });
      if (error) throw new Error("Nie udało się odebrać roli.");
    }
    return { ok: true };
  });
