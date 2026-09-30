// Single source of admin authorization + central event log for the admin panel.
type Ctx = { supabase: any; userId: string };

export async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) {
    await logEvent({ type: "access_denied", actor: ctx.userId, result: "denied" });
    throw new Error("Brak uprawnień administratora.");
  }
}

export async function logEvent(e: { type: string; actor?: string | null; objectKind?: string | undefined; objectId?: string | undefined; result?: "ok" | "failed" | "denied"; detail?: string | undefined }) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_events").insert({
      type: e.type, actor: e.actor ?? null, object_kind: e.objectKind ?? null, object_id: e.objectId ?? null,
      result: e.result ?? "ok", detail: e.detail?.slice(0, 300) ?? null,
    });
  } catch (err) {
    console.error("admin event log failed", err);
  }
}

// Platform/security configuration changes: superadmin only. Denials are logged.
export async function assertSuperadmin(ctx: Ctx, op: string) {
  await assertAdmin(ctx);
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "superadmin" });
  if (!data) {
    await logEvent({ type: "access_denied", actor: ctx.userId, objectKind: "settings", objectId: op, result: "denied", detail: "Wymagana rola superadministratora" });
    throw new Error("Tę zmianę może wykonać tylko superadministrator.");
  }
}
