export type InstagramOAuthCallback =
  | { status: "cancelled" }
  | { status: "invalid" }
  | { status: "ready"; state: string; code: string };

export function readInstagramOAuthCallback(search: URLSearchParams): InstagramOAuthCallback {
  if (search.has("error")) return { status: "cancelled" };

  const state = search.get("state")?.trim() ?? "";
  const code = search.get("code")?.trim() ?? "";
  if (state.length < 20 || state.length > 200 || code.length < 1 || code.length > 2000) {
    return { status: "invalid" };
  }

  return { status: "ready", state, code };
}
