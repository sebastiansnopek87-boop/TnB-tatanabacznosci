// Centrum kontroli TNB — ETAP 1: wyłącznie odczyt.
// Agreguje istniejące dane (zamówienia, zgłoszenia, konta, zdarzenia) bez
// jakichkolwiek zapisów. Nie wywołuje ensure_identities (ta funkcja zapisuje).
import { assertAdmin } from "./admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ACCESS_STATUSES = ["paid", "refund_pending", "refunded"];
const hasAccess = (o: { status: string; paid_at: string | null; access_revoked_at: string | null }) =>
  !!o.paid_at && !o.access_revoked_at && ACCESS_STATUSES.includes(o.status);

const ORDER_COLS =
  "id, order_number, created_at, paid_at, delivered_at, status, delivery_status, buyer_email, buyer_name, amount, currency, payment_method, provider, environment, is_test, user_id, access_expires_at, access_revoked_at, item_id, library_items(title, slug)";

type OrderRow = {
  id: string; order_number: string; created_at: string; paid_at: string | null; delivered_at: string | null;
  status: string; delivery_status: string; buyer_email: string; buyer_name: string | null; amount: number;
  currency: string; payment_method: string; provider: string | null; environment: string; is_test: boolean;
  user_id: string | null; access_expires_at: string | null; access_revoked_at: string | null; item_id: string;
  library_items: { title: string; slug: string } | null;
};

function orderWarnings(o: OrderRow): string[] {
  const w: string[] = [];
  if (ACCESS_STATUSES.includes(o.status) && !o.paid_at) w.push("Status płatności bez daty opłacenia.");
  if (o.paid_at && ["pending", "failed", "cancelled"].includes(o.status)) w.push("Data opłacenia przy statusie bez płatności.");
  if (o.status === "paid" && o.access_revoked_at) w.push("Dostęp cofnięty przy statusie „Opłacone”.");
  if (o.delivered_at && !hasAccess(o)) w.push("Oznaczono jako dostarczone bez aktywnego dostępu.");
  if (o.access_expires_at && hasAccess(o) && new Date(o.access_expires_at) < new Date()) w.push("Dostęp wygasł.");
  return w;
}

const shapeOrder = (o: OrderRow) => ({
  id: o.id, orderNumber: o.order_number, createdAt: o.created_at, paidAt: o.paid_at, deliveredAt: o.delivered_at,
  status: o.status, deliveryStatus: o.delivery_status, buyerEmail: o.buyer_email, buyerName: o.buyer_name,
  amount: o.amount, currency: o.currency, paymentMethod: o.payment_method, provider: o.provider,
  environment: o.environment, isTest: o.is_test, userId: o.user_id,
  accessRevokedAt: o.access_revoked_at, accessExpiresAt: o.access_expires_at,
  itemId: o.item_id, itemTitle: o.library_items?.title ?? "", itemSlug: o.library_items?.slug ?? "",
  access: hasAccess(o), warnings: orderWarnings(o),
});
export type ControlOrder = ReturnType<typeof shapeOrder>;

export const controlCenterSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().min(2, "Wpisz co najmniej 2 znaki.").max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.q.toLowerCase();
    const safe = data.q.replace(/[%,()*\\]/g, " ").trim();

    // 1) Konta: e-mail / imię i nazwisko (auth.users, tylko odczyt) + TNB ID (user_identities).
    const [{ data: idRows }, { data: authRes }] = await Promise.all([
      supabaseAdmin.from("user_identities").select("user_id, tnb_id").ilike("tnb_id", `%${safe}%`).limit(20),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const authUsers = (authRes?.users ?? []) as Array<{ id: string; email?: string; created_at: string; email_confirmed_at?: string | null; last_sign_in_at?: string | null; user_metadata?: Record<string, unknown> }>;
    const nameOf = (u: (typeof authUsers)[number]) => {
      const m = u.user_metadata ?? {};
      const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
      return [s(m["first_name"]), s(m["last_name"])].filter(Boolean).join(" ") || s(m["full_name"]) || s(m["name"]);
    };
    const matchedIds = new Set<string>((idRows ?? []).map((r) => r.user_id));
    for (const u of authUsers) {
      if ((u.email ?? "").toLowerCase().includes(q) || nameOf(u).toLowerCase().includes(q)) matchedIds.add(u.id);
    }

    // 2) Zamówienia: numer, e-mail, nazwisko kupującego.
    const { data: orderRows } = await context.supabase
      .from("library_orders").select(ORDER_COLS)
      .or(`order_number.ilike.%${safe}%,buyer_email.ilike.%${safe}%,buyer_name.ilike.%${safe}%`)
      .order("created_at", { ascending: false }).limit(100);
    const orders = (orderRows ?? []) as unknown as OrderRow[];
    for (const o of orders) if (o.user_id) matchedIds.add(o.user_id);

    // 3) Bezpłatne zgłoszenia: e-mail, imię, nazwisko.
    const { data: reqRows } = await context.supabase
      .from("library_requests")
      .select("id, item_id, item_title, mode, status, user_id, first_name, last_name, email, downloaded_at, download_count, notification_status, created_at")
      .or(`email.ilike.%${safe}%,first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`)
      .order("created_at", { ascending: false }).limit(100);
    const requests = (reqRows ?? []) as Array<{ id: string; item_id: string; item_title: string; mode: string; status: string; user_id: string | null; first_name: string | null; last_name: string | null; email: string | null; downloaded_at: string | null; download_count: number; notification_status: string | null; created_at: string }>;
    for (const r of requests) if (r.user_id) matchedIds.add(r.user_id);

    // 4) Powiązane dane znalezionych kont: role, TNB ID, ich zamówienia i zgłoszenia.
    const ids = [...matchedIds];
    const [rolesRes, identRes] = await Promise.all([
      ids.length ? supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabaseAdmin.from("user_identities").select("user_id, tnb_id").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
    ]);
    const rolesMap = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) rolesMap.set(r.user_id, [...(rolesMap.get(r.user_id) ?? []), r.role]);
    const tnbMap = new Map<string, string>((identRes.data ?? []).map((r: any) => [r.user_id, r.tnb_id]));

    const emails = ids.map((id) => (authUsers.find((u) => u.id === id)?.email ?? "").toLowerCase()).filter(Boolean);
    let userOrders: OrderRow[] = [];
    let userRequests: typeof requests = [];
    if (ids.length) {
      const orParts = [...ids.map((i) => `user_id.eq.${i}`), ...emails.map((e) => `buyer_email.eq.${e}`)];
      const { data: uo } = await context.supabase.from("library_orders").select(ORDER_COLS).or(orParts.join(",")).order("created_at", { ascending: false }).limit(200);
      userOrders = (uo ?? []) as unknown as OrderRow[];
      const reqOr = [...ids.map((i) => `user_id.eq.${i}`), ...emails.map((e) => `email.eq.${e}`)];
      const { data: ur } = await context.supabase
        .from("library_requests")
        .select("id, item_id, item_title, mode, status, user_id, first_name, last_name, email, downloaded_at, download_count, notification_status, created_at")
        .or(reqOr.join(",")).order("created_at", { ascending: false }).limit(200);
      userRequests = (ur ?? []) as typeof requests;
    }

    // Scal i usuń duplikaty.
    const orderMap = new Map<string, OrderRow>();
    for (const o of [...orders, ...userOrders]) orderMap.set(o.id, o);
    const allOrders = [...orderMap.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const reqMap = new Map<string, (typeof requests)[number]>();
    for (const r of [...requests, ...userRequests]) reqMap.set(r.id, r);
    const allRequests = [...reqMap.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));

    // 5) Wspólna chronologiczna lista zdarzeń z istniejących rejestrów.
    const orderIds = allOrders.map((o) => o.id);
    const [orderEventsRes, adminEventsRes] = await Promise.all([
      orderIds.length
        ? context.supabase.from("library_order_events").select("order_id, type, detail, created_at").in("order_id", orderIds).order("created_at", { ascending: false }).limit(300)
        : Promise.resolve({ data: [] as any[] }),
      ids.length || orderIds.length
        ? context.supabase.from("admin_events").select("created_at, type, actor, object_kind, object_id, result, detail")
            .or([...ids.map((i) => `actor.eq.${i}`), ...orderIds.map((i) => `object_id.eq.${i}`)].join(","))
            .order("created_at", { ascending: false }).limit(300)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const orderNumberById = new Map(allOrders.map((o) => [o.id, o.order_number]));
    const timeline = [
      ...(orderEventsRes.data ?? []).map((e: any) => ({
        at: e.created_at as string, source: "order" as const,
        label: `Zamówienie ${orderNumberById.get(e.order_id) ?? ""}: ${e.type}`,
        detail: (e.detail as string | null) ?? null, result: null as string | null,
      })),
      ...(adminEventsRes.data ?? []).map((e: any) => ({
        at: e.created_at as string, source: "admin" as const,
        label: `${e.type}${e.object_kind ? ` (${e.object_kind})` : ""}`,
        detail: (e.detail as string | null) ?? null, result: (e.result as string | null) ?? null,
      })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);

    const users = ids.map((id) => {
      const u = authUsers.find((a) => a.id === id);
      return {
        id, email: u?.email ?? null, name: u ? nameOf(u) || null : null,
        tnbId: tnbMap.get(id) ?? null, roles: rolesMap.get(id) ?? [],
        createdAt: u?.created_at ?? null, confirmed: !!u?.email_confirmed_at, lastSignInAt: u?.last_sign_in_at ?? null,
      };
    });

    return {
      users,
      orders: allOrders.map(shapeOrder),
      requests: allRequests.map((r) => ({
        id: r.id, itemId: r.item_id, itemTitle: r.item_title, mode: r.mode, status: r.status, userId: r.user_id,
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null, email: r.email,
        downloadedAt: r.downloaded_at, downloadCount: r.download_count, notificationStatus: r.notification_status, createdAt: r.created_at,
        warnings: (r.download_count > 0 && !r.downloaded_at ? ["Pobrania bez daty pobrania."] : []) as string[],
      })),
      timeline,
    };
  });
