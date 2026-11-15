import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.2";
export type EdgeContext = { supabase: SupabaseClient; userId: string };
type ServerInput<D> = { data: D; context: EdgeContext };
type Builder<D> = {
  middleware: (items: unknown[]) => Builder<D>;
  inputValidator: <R>(validator: (value: unknown) => R) => Builder<R>;
  handler: <R>(handler: (input: ServerInput<D>) => R | Promise<R>) => (input: { data: unknown; context: EdgeContext }) => Promise<R>;
};
function build<D>(validate: (value: unknown) => D): Builder<D> {
  return {
    middleware: (_items) => build(validate),
    inputValidator: <R>(validator: (value: unknown) => R) => build(validator),
    handler: <R>(handler: (input: ServerInput<D>) => R | Promise<R>) => async (input) =>
      await handler({ data: validate(input.data), context: input.context })
  };
}
export function createServerFn(_options?: { method?: "GET" | "POST" }) { return build((value: unknown) => value); }
export async function requireSupabaseAuth(_input: unknown) { return null; }
function readSecret(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name); if (!raw) continue;
    try { const parsed = JSON.parse(raw); if (typeof parsed === "string") return parsed; if (parsed && typeof parsed.default === "string") return parsed.default; }
    catch { return raw; }
  }
  return null;
}
function createFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
    headers.set("apikey", key); return fetch(input, { ...init, headers });
  };
}
function makeAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL"), key = readSecret("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Usługa materiałów redakcyjnych nie jest skonfigurowana.");
  return createClient(url, key, { global: { fetch: createFetch(key) }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
export const supabaseAdmin = makeAdminClient();
type AdminEvent = { type: string; actor?: string | null; objectKind?: string | null; objectId?: string | null; result?: "ok" | "failed" | "denied"; detail?: string | null };
export async function logEvent(event: AdminEvent) {
  try { await supabaseAdmin.from("admin_events").insert({ type: event.type, actor: event.actor ?? null, object_kind: event.objectKind ?? null, object_id: event.objectId ?? null, result: event.result ?? "ok", detail: event.detail?.slice(0, 300) ?? null }); }
  catch (error) { console.error("AI material admin event log failed", error); }
}
export async function assertSuperadmin(ctx: EdgeContext, operation: string) {
  const { data: admin, error: adminError } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (adminError || !admin) { await logEvent({ type: "access_denied", actor: ctx.userId, result: "denied", objectKind: "settings", objectId: operation }); throw new Error("Brak uprawnień administratora."); }
  const { data: allowed, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "superadmin" });
  if (error || !allowed) { await logEvent({ type: "access_denied", actor: ctx.userId, result: "denied", objectKind: "settings", objectId: operation, detail: "Wymagana rola superadministratora" }); throw new Error("Tę operację może wykonać tylko superadministrator."); }
}
