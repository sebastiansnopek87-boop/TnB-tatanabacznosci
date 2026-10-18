// Read-only presentation helpers; these never grant or revoke access.
export const SEARCH_LIMIT = 100;
export const HISTORY_SIZE = 30;
export type ReadState = { error: string | null; limited: boolean; incomplete: boolean };
export function readState(error: unknown, count: number, limit: number, incomplete = false): ReadState {
  return { error: error ? "Nie udało się pobrać danych. Spróbuj ponownie." : null, limited: !error && count > limit, incomplete };
}
export function searchParts(q: string) {
  const safe = q.replace(/[%,()*\\"\r\n]/g, " ").replace(/\s+/g, " ").trim();
  return { safe, words: safe.split(" ").filter(Boolean) };
}
export const filterValue = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
export function requestNameFilter(words: string[]) {
  return words.length > 1 ? `and(first_name.ilike.${filterValue(`%${words.slice(0, -1).join(" ")}%`)},last_name.ilike.${filterValue(`%${words.at(-1)}%`)})` : null;
}
export function accountMatches(userId: string | null, email: string | null, users: Array<{ id: string; email: string | null }>) {
  return users.flatMap<{ userId: string; kind: "user_id" | "email" }>((u) => userId === u.id ? [{ userId: u.id, kind: "user_id" as const }]
    : email && u.email && email.toLowerCase() === u.email.toLowerCase() ? [{ userId: u.id, kind: "email" as const }] : []);
}
export function accessPresentation(allowed: boolean, expiresAt: string | null, now = Date.now()) {
  const expired = !!expiresAt && new Date(expiresAt).getTime() <= now;
  return { allowed, expired, label: allowed && expired ? "Reguła dostępu spełniona — data ważności minęła, wymaga weryfikacji" : allowed ? "aktywny" : "brak" };
}
export type HistoryEvent = { id: string; at: string; source: "order" | "admin"; type: string; actor: string | null; objectKind: string; objectId: string; detail: string | null; result: string | null };
export function historyPage(order: HistoryEvent[], admin: HistoryEvent[], offsets: { order: number; admin: number }) {
  const rows = [...order, ...admin].sort((a, b) => b.at.localeCompare(a.at) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id)).slice(0, HISTORY_SIZE);
  return { rows, next: { order: offsets.order + rows.filter((r) => r.source === "order").length, admin: offsets.admin + rows.filter((r) => r.source === "admin").length }, hasMore: order.length + admin.length > rows.length };
}