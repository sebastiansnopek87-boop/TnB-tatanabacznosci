// Single source of admin authorization + central event log for the admin panel.
type Ctx = { supabase: any; userId: string };

export async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) {
    await logEvent({ type: "access_denied", actor: ctx.userId, result: "denied" });
    throw new Error("Brak uprawnień administratora.");
  }
}

export async function logEvent(e: { type: string; actor?: string | null; objectKind?: string; objectId?: string; result?: "ok" | "failed" | "denied"; detail?: string }) {
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
