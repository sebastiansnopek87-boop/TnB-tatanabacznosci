// Centrum kontroli: business data reads only; never call cleanup or identity writers.
import { assertAdmin } from "./admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SEARCH_LIMIT, HISTORY_SIZE, readState, searchParts, requestNameFilter, filterValue, accountMatches, accessPresentation, historyPage, type HistoryEvent } from "./control-center";

const ORDER_COLS = "id, order_number, created_at, paid_at, delivered_at, status, delivery_status, buyer_email, buyer_name, amount, currency, payment_method, provider, environment, is_test, user_id, access_expires_at, access_revoked_at, item_id, library_items(title, slug)";
const REQUEST_COLS = "id, item_id, item_title, mode, status, user_id, first_name, last_name, email, downloaded_at, download_count, notification_status, created_at";
type OrderRow = { id: string; order_number: string; created_at: string; paid_at: string | null; delivered_at: string | null; status: string; delivery_status: string; buyer_email: string; buyer_name: string | null; amount: number; currency: string; payment_method: string; provider: string | null; environment: string; is_test: boolean; user_id: string | null; access_expires_at: string | null; access_revoked_at: string | null; item_id: string; library_items: { title: string; slug: string } | null };
type RequestRow = { id: string; item_id: string; item_title: string; mode: string; status: string; user_id: string | null; first_name: string | null; last_name: string | null; email: string | null; downloaded_at: string | null; download_count: number; notification_status: string | null; created_at: string };
type AuthUser = { id: string; email?: string; created_at: string; email_confirmed_at?: string | null; last_sign_in_at?: string | null; user_metadata?: Record<string, unknown> };
const nameOf = (u: AuthUser) => {
  const m = u.user_metadata ?? {};
  const s = (v: unknown) => typeof v === "string" ? v.trim() : "";
  return [s(m["first_name"]), s(m["last_name"])].filter(Boolean).join(" ") || s(m["full_name"]) || s(m["name"]);
};
// Catch both returned query errors and rejected reads; no raw errors reach the UI.
async function read<T>(query: PromiseLike<{ data: T | null; error: unknown }>): Promise<{ data: T | null; error: unknown }> {
  try { return await query; } catch { return { data: null, error: true }; }
}

export const controlCenterSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().min(2, "Wpisz co najmniej 2 znaki.").max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hasAccess } = await import("./orders.server");
    const { safe, words } = searchParts(data.q);
    if (safe.length < 2) throw new Error("Wpisz co najmniej 2 znaki wyszukiwania.");
    const pattern = filterValue(`%${safe}%`);
    const [identSearch, authResult, materials] = await Promise.all([
      read(context.supabase.from("user_identities").select("user_id, tnb_id").ilike("tnb_id", `%${safe}%`).limit(SEARCH_LIMIT + 1)),
      read(supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })),
      read(context.supabase.from("library_items").select("id, slug, title").eq("slug", safe).limit(SEARCH_LIMIT + 1)),
    ]);
    const authUsers: AuthUser[] = authResult.error ? [] : authResult.data?.users ?? [];
    const matched = new Set<string>(identSearch.error ? [] : (identSearch.data ?? []).slice(0, SEARCH_LIMIT).map((r) => r.user_id));
    for (const u of authUsers) if ((u.email ?? "").toLowerCase().includes(safe.toLowerCase()) || nameOf(u).toLowerCase().includes(safe.toLowerCase())) matched.add(u.id);
    const itemIds = materials.error ? [] : (materials.data ?? []).slice(0, SEARCH_LIMIT).map((m) => m.id);
    const itemFilter = itemIds.length ? `,item_id.in.(${itemIds.join(",")})` : "";
    const fullName = requestNameFilter(words);
    const [orderSearch, requestSearch] = await Promise.all([
      read(context.supabase.from("library_orders").select(ORDER_COLS).or(`order_number.ilike.${pattern},buyer_email.ilike.${pattern},buyer_name.ilike.${pattern}${itemFilter}`).order("created_at", { ascending: false }).limit(SEARCH_LIMIT + 1)),
      read(context.supabase.from("library_requests").select(REQUEST_COLS).or(`email.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}${fullName ? `,${fullName}` : ""}${itemFilter}`).order("created_at", { ascending: false }).limit(SEARCH_LIMIT + 1)),
    ]);
    const orders = (orderSearch.error ? [] : orderSearch.data ?? []) as unknown as OrderRow[];
    const requests = (requestSearch.error ? [] : requestSearch.data ?? []) as RequestRow[];
    for (const o of orders.slice(0, SEARCH_LIMIT)) if (o.user_id) matched.add(o.user_id);
    for (const r of requests.slice(0, SEARCH_LIMIT)) if (r.user_id) matched.add(r.user_id);
    // Email-only matches are candidates, never confirmed ownership.
    const emailsFound = new Set([...orders.slice(0, SEARCH_LIMIT).map((o) => o.buyer_email.toLowerCase()), ...requests.slice(0, SEARCH_LIMIT).flatMap((r) => r.email ? [r.email.toLowerCase()] : [])]);
    for (const u of authUsers) if (u.email && emailsFound.has(u.email.toLowerCase())) matched.add(u.id);
    const ids = [...matched].slice(0, SEARCH_LIMIT);
    const emails = authUsers.filter((u) => ids.includes(u.id)).flatMap((u) => u.email ? [u.email.toLowerCase()] : []);
    const orderLinks = [...ids.map((id) => `user_id.eq.${id}`), ...emails.map((email) => `buyer_email.eq.${filterValue(email)}`)];
    const requestLinks = [...ids.map((id) => `user_id.eq.${id}`), ...emails.map((email) => `email.eq.${filterValue(email)}`)];
    const empty = { data: [], error: null };
    const [roles, identities, linkedOrders, linkedRequests] = await Promise.all([
      ids.length ? read(context.supabase.from("user_roles").select("user_id, role").in("user_id", ids)) : empty,
      ids.length ? read(context.supabase.from("user_identities").select("user_id, tnb_id").in("user_id", ids)) : empty,
      orderLinks.length ? read(context.supabase.from("library_orders").select(ORDER_COLS).or(orderLinks.join(",")).order("created_at", { ascending: false }).limit(SEARCH_LIMIT + 1)) : empty,
      requestLinks.length ? read(context.supabase.from("library_requests").select(REQUEST_COLS).or(requestLinks.join(",")).order("created_at", { ascending: false }).limit(SEARCH_LIMIT + 1)) : empty,
    ]);
    const users = ids.map((id) => {
      const u = authUsers.find((a) => a.id === id);
      return { id, email: u?.email ?? null, name: u ? nameOf(u) || null : null,
        tnbId: identities.error ? null : identities.data?.find((r) => r.user_id === id)?.tnb_id ?? null,
        roles: roles.error ? null : (roles.data ?? []).filter((r) => r.user_id === id).map((r) => r.role),
        confirmed: u ? !!u.email_confirmed_at : null, createdAt: u?.created_at ?? null };
    });
    const allOrders = [...new Map([...orders.slice(0, SEARCH_LIMIT), ...(linkedOrders.error ? [] : linkedOrders.data ?? []) as unknown as OrderRow[]].map((o) => [o.id, o])).values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const allRequests = [...new Map([...requests.slice(0, SEARCH_LIMIT), ...(linkedRequests.error ? [] : linkedRequests.data ?? []) as RequestRow[]].map((r) => [r.id, r])).values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const sourceIncomplete = !!(identSearch.error || authResult.error || materials.error) || authUsers.length >= 1000 || matched.size > SEARCH_LIMIT;
    return {
      states: {
        users: readState(authResult.error || identSearch.error || roles.error || identities.error, Math.max(matched.size, identSearch.data?.length ?? 0), SEARCH_LIMIT, authUsers.length >= 1000),
        materials: readState(materials.error, materials.data?.length ?? 0, SEARCH_LIMIT),
        orders: readState(orderSearch.error || linkedOrders.error, Math.max(orders.length, linkedOrders.data?.length ?? 0, allOrders.length), SEARCH_LIMIT, sourceIncomplete),
        requests: readState(requestSearch.error || linkedRequests.error, Math.max(requests.length, linkedRequests.data?.length ?? 0, allRequests.length), SEARCH_LIMIT, sourceIncomplete),
      }, users,
      materials: materials.error ? [] : materials.data ?? [],
      orders: allOrders.slice(0, SEARCH_LIMIT).map((o) => {
        const access = accessPresentation(hasAccess(o), o.access_expires_at);
        const warnings: string[] = [];
        if (["paid", "refund_pending", "refunded"].includes(o.status) && !o.paid_at) warnings.push("Status płatności bez daty opłacenia.");
        if (o.paid_at && ["pending", "failed", "cancelled"].includes(o.status)) warnings.push("Data opłacenia przy statusie bez płatności.");
        if (o.status === "paid" && o.access_revoked_at) warnings.push("Dostęp cofnięty przy statusie „Opłacone”.");
        if (o.delivered_at && !access.allowed) warnings.push("Oznaczono jako dostarczone bez spełnienia reguły dostępu.");
        return { id: o.id, orderNumber: o.order_number, itemId: o.item_id, itemTitle: o.library_items?.title ?? "", itemSlug: o.library_items?.slug ?? null,
          createdAt: o.created_at, status: o.status, amount: o.amount, currency: o.currency, isTest: o.is_test, paidAt: o.paid_at,
          buyerEmail: o.buyer_email, userId: o.user_id, access, accessExpiresAt: o.access_expires_at, accessRevokedAt: o.access_revoked_at,
          matches: accountMatches(o.user_id, o.buyer_email, users), warnings };
      }),
      requests: allRequests.slice(0, SEARCH_LIMIT).map((r) => ({ id: r.id, itemId: r.item_id, itemTitle: r.item_title, mode: r.mode, status: r.status, userId: r.user_id,
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null, email: r.email, createdAt: r.created_at,
        downloadedAt: r.downloaded_at, downloadCount: r.download_count, notificationStatus: r.notification_status,
        matches: accountMatches(r.user_id, r.email, users), warnings: r.download_count > 0 && !r.downloaded_at ? ["Pobrania bez daty pobrania."] : [] })),
    };
  });

export const controlCenterHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: z.enum(["order", "user", "library_request", "actor"]), id: z.string().uuid(), offsets: z.object({ order: z.number().int().min(0).max(1000000), admin: z.number().int().min(0).max(1000000) }).default({ order: 0, admin: 0 }), before: z.string().datetime().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Freeze the upper boundary so newer writes don't shift subsequent pages.
    const before = data.before ?? new Date().toISOString();
    const empty = { data: [], error: null };
    let adminQuery = context.supabase.from("admin_events").select("id, created_at, type, actor, object_kind, object_id, result, detail").lte("created_at", before);
    adminQuery = data.kind === "actor" ? adminQuery.eq("actor", data.id) : adminQuery.eq("object_kind", data.kind).eq("object_id", data.id);
    const [orderRes, adminRes] = await Promise.all([
      data.kind === "order" ? read(context.supabase.from("library_order_events").select("id, order_id, type, detail, created_at").eq("order_id", data.id).lte("created_at", before).order("created_at", { ascending: false }).order("id", { ascending: true }).range(data.offsets.order, data.offsets.order + HISTORY_SIZE)) : empty,
      read(adminQuery.order("created_at", { ascending: false }).order("id", { ascending: true }).range(data.offsets.admin, data.offsets.admin + HISTORY_SIZE)),
    ]);
    if (orderRes.error || adminRes.error) return { ...historyPage([], [], data.offsets), error: "Nie udało się pobrać historii. Spróbuj ponownie.", before };
    const orderRows: HistoryEvent[] = (orderRes.data ?? []).map((e) => ({ id: e.id, at: e.created_at, source: "order", type: e.type, actor: null, objectKind: "order", objectId: e.order_id, detail: e.detail, result: null }));
    const adminRows: HistoryEvent[] = (adminRes.data ?? []).map((e) => ({ id: e.id, at: e.created_at, source: "admin", type: e.type, actor: e.actor, objectKind: e.object_kind ?? "—", objectId: e.object_id ?? "—", detail: e.detail, result: e.result }));
    return { ...historyPage(orderRows, adminRows, data.offsets), error: null, before };
  });
