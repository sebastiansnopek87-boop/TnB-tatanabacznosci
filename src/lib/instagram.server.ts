// Głos TNB ↔ Instagram API with Instagram Login (official Meta OAuth). Server-only.
// App credentials: INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET (env). The long-lived user token
// lives in instagram_secret (service-role only). No password is ever handled.
const GRAPH = "https://graph.instagram.com";
export const STALE_MS = 30 * 60 * 1000;
export const CALLBACK_PATH = "/api/public/instagram/callback";
export class IgError extends Error {}

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
/** Production origin comes only from the SITE_PRODUCTION_URL setting — never invented. */
export function productionOrigin(): string | null {
  const v = (process.env["SITE_PRODUCTION_URL"] ?? "").trim();
  try { const u = new URL(v); return u.protocol === "https:" ? u.origin : null; } catch { return null; }
}
/** Honest config check: reports only what the server can verify, never secret values. */
export async function checkConfig() {
  const id = (process.env["INSTAGRAM_APP_ID"] ?? "").trim(), secret = (process.env["INSTAGRAM_APP_SECRET"] ?? "").trim();
  const db = await admin();
  const { data: row } = await db.from("instagram_secret").select("id").eq("id", 1).maybeSingle();
  const checks = [
    { key: "app_id", label: "Instagram App ID zapisany", ok: !!id, hint: id && !/^\d{6,25}$/.test(id) ? "App ID powinien składać się z samych cyfr." : undefined },
    { key: "app_secret", label: "Instagram App Secret zapisany (tylko na serwerze)", ok: secret.length >= 16 },
    { key: "server", label: "Konfiguracja serwerowa (magazyn tokenu)", ok: !!row },
    { key: "callback", label: "Adres zwrotny (callback) przygotowany", ok: true },
    { key: "prod", label: "Domena produkcyjna ustawiona", ok: !!productionOrigin(), optional: true },
  ];
  return { ok: checks.filter((c) => !c.optional).every((c) => c.ok && !c.hint), checks };
}
export const appConfigured = () => !!(process.env["INSTAGRAM_APP_ID"] && process.env["INSTAGRAM_APP_SECRET"]);
const app = () => {
  const id = process.env["INSTAGRAM_APP_ID"], secret = process.env["INSTAGRAM_APP_SECRET"];
  if (!id || !secret) throw new IgError("Brak konfiguracji aplikacji Meta (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET).");
  return { id, secret };
};

async function j(r: Response) {
  const b = (await r.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } | string; error_message?: string };
  if (!r.ok || b.error) {
    const m = typeof b.error === "string" ? b.error_message ?? b.error : b.error?.message ?? b.error_message ?? `HTTP ${r.status}`;
    throw new IgError(`Instagram API: ${m}`);
  }
  return b as { access_token?: string; expires_in?: number; user_id?: string | number; id?: string; username?: string; data?: unknown };
}

export async function startOAuth(origin: string, actor: string) {
  const { id } = app();
  const state = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const redirect = origin + CALLBACK_PATH;
  const db = await admin();
  await db.from("instagram_secret").update({ oauth_state: state, oauth_state_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), oauth_redirect: redirect, oauth_actor: actor, updated_at: new Date().toISOString() }).eq("id", 1);
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", id); u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("response_type", "code"); u.searchParams.set("scope", "instagram_business_basic");
  u.searchParams.set("state", state);
  return u.toString();
}

/** Called by the public callback route: verifies single-use state, exchanges code -> long-lived token. */
export async function finishOAuth(state: string, code: string) {
  const db = await admin();
  const { data: s } = await db.from("instagram_secret").select("oauth_state, oauth_state_expires_at, oauth_redirect, oauth_actor").eq("id", 1).maybeSingle();
  if (!s?.oauth_state || s.oauth_state !== state || !s.oauth_state_expires_at || new Date(s.oauth_state_expires_at) < new Date()) throw new IgError("Nieprawidłowy lub wygasły parametr autoryzacji.");
  await db.from("instagram_secret").update({ oauth_state: null, oauth_state_expires_at: null }).eq("id", 1);
  const { id, secret } = app();
  const short = await j(await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "authorization_code", redirect_uri: s.oauth_redirect!, code: code.replace(/#_$/, "") }),
  }));
  const ll = await j(await fetch(`${GRAPH}/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: secret, access_token: String(short.access_token) })}`));
  const token = String(ll.access_token);
  const me = await j(await fetch(`${GRAPH}/me?${new URLSearchParams({ fields: "user_id,username", access_token: token })}`));
  const now = new Date().toISOString();
  await db.from("instagram_secret").update({ access_token: token, token_expires_at: new Date(Date.now() + Number(ll.expires_in ?? 5_184_000) * 1000).toISOString(), updated_at: now }).eq("id", 1);
  await db.from("instagram_source").update({ status: "ok", ig_user_id: String(me.user_id ?? me.id), username: String(me.username), profile_url: `https://www.instagram.com/${me.username}/`, connected_at: now, connected_by: s.oauth_actor, last_error: null, updated_at: now }).eq("id", 1);
  return { username: String(me.username), actor: s.oauth_actor as string | null };
}

export async function disconnect() {
  const db = await admin();
  await db.from("instagram_secret").update({ access_token: null, token_expires_at: null, oauth_state: null, updated_at: new Date().toISOString() }).eq("id", 1);
  await db.from("instagram_source").update({ status: "disconnected", ig_user_id: null, username: null, profile_url: null, connected_at: null, last_error: null, media_count: 0, updated_at: new Date().toISOString() }).eq("id", 1);
  await db.from("instagram_media").delete().neq("ig_id", "");
}

type M = { id: string; media_type: string; media_product_type?: string; media_url?: string; thumbnail_url?: string; permalink: string; caption?: string; timestamp: string };

export async function sync() {
  const db = await admin();
  const [{ data: sec }, { data: src }] = await Promise.all([
    db.from("instagram_secret").select("access_token, token_expires_at").eq("id", 1).maybeSingle(),
    db.from("instagram_source").select("show_reels, show_posts, show_carousels").eq("id", 1).maybeSingle(),
  ]);
  if (!sec?.access_token) throw new IgError("Konto Instagram nie jest połączone.");
  let token = sec.access_token;
  try {
    // Long-lived tokens last 60 days; refresh when <10 days left.
    if (sec.token_expires_at && new Date(sec.token_expires_at).getTime() - Date.now() < 10 * 86_400_000) {
      const r = await j(await fetch(`${GRAPH}/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token })}`));
      token = String(r.access_token);
      await db.from("instagram_secret").update({ access_token: token, token_expires_at: new Date(Date.now() + Number(r.expires_in ?? 5_184_000) * 1000).toISOString() }).eq("id", 1);
    }
    const r = await j(await fetch(`${GRAPH}/me/media?${new URLSearchParams({ fields: "id,media_type,media_product_type,media_url,thumbnail_url,permalink,caption,timestamp", limit: "50", access_token: token })}`));
    const items = ((r.data as M[]) ?? []).filter((m) => {
      const reel = m.media_product_type === "REELS";
      if (reel) return src?.show_reels ?? true;
      if (m.media_type === "CAROUSEL_ALBUM") return !!src?.show_carousels;
      return !!src?.show_posts && m.media_type === "IMAGE";
    });
    const { data: existing } = await db.from("instagram_media").select("ig_id");
    const had = new Set((existing ?? []).map((x) => x.ig_id));
    const rows = items.map((m) => ({ ig_id: m.id, media_type: m.media_type, product_type: m.media_product_type ?? null, thumbnail_url: m.thumbnail_url ?? (m.media_type === "VIDEO" ? null : m.media_url ?? null), permalink: m.permalink, caption: (m.caption ?? "").slice(0, 500), posted_at: m.timestamp, synced_at: new Date().toISOString() }));
    if (rows.length) { const { error } = await db.from("instagram_media").upsert(rows, { onConflict: "ig_id" }); if (error) throw new IgError("Zapis materiałów nie powiódł się."); }
    const keep = rows.map((x) => x.ig_id);
    // Drop media no longer matching filters / removed from the account.
    if (keep.length) await db.from("instagram_media").delete().not("ig_id", "in", `(${keep.map((k) => `"${k}"`).join(",")})`);
    else await db.from("instagram_media").delete().neq("ig_id", "");
    const added = keep.filter((k) => !had.has(k)).length;
    await db.from("instagram_source").update({ status: "ok", last_sync_at: new Date().toISOString(), last_sync_added: added, media_count: rows.length, last_error: null }).eq("id", 1);
    return { added, total: rows.length };
  } catch (e) {
    const m = e instanceof Error ? e.message : "Błąd synchronizacji Instagram";
    await db.from("instagram_source").update({ status: "error", last_error: m.slice(0, 500), last_sync_at: new Date().toISOString() }).eq("id", 1);
    throw e instanceof IgError ? e : new IgError(m);
  }
}

export async function syncIfStale() {
  const db = await admin();
  const { data } = await db.from("instagram_source").select("status, last_sync_at").eq("id", 1).maybeSingle();
  if (!data || data.status === "disconnected") return;
  if (data.last_sync_at && Date.now() - new Date(data.last_sync_at).getTime() < STALE_MS) return;
  await sync().catch(() => {});
}
