import { assertAdmin, logEvent } from "./admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CONSENT = "Akceptuję Regulamin i Politykę prywatności. Wyrażam zgodę na przetwarzanie imienia, nazwiska, adresu e-mail i (opcjonalnie) numeru telefonu w celu realizacji zamówienia i dostarczenia materiału.";
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const PROVIDERS = ["p24", "tpay", "payu"] as const;
const PROVIDER_LABEL: Record<string, string> = { p24: "Przelewy24", tpay: "Tpay", payu: "PayU" };

async function optionalUser() {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.split(".").length !== 3) return null;
  const { data } = await (await admin()).auth.getUser(token);
  return data.user ?? null;
}

// Public: which online operators can be offered at checkout (enabled + fully configured).
export const getCheckoutOptions = createServerFn({ method: "GET" }).handler(async () => {
  const { configStatus } = await import("./payments/providers.server");
  const { data } = await (await admin()).from("payment_providers").select("id, enabled, is_default, environment, merchant_id, pos_id, client_id");
  const list = (data ?? []).filter((p: any) => p.enabled && configStatus(p).configured)
    .map((p: any) => ({ id: p.id as (typeof PROVIDERS)[number], label: PROVIDER_LABEL[p.id]!, isDefault: p.is_default, test: p.environment === "sandbox" }));
  return { providers: list };
});

// Creates an order (price always from the DB). Online: registers the transaction at the operator
// and returns its redirect URL. The order stays "pending" until a verified operator notification.
export const createLibraryOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
    name: z.string().trim().min(3, "Podaj imię i nazwisko.").max(120),
    email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
    phone: z.string().trim().max(20).regex(/^$|^\+?[0-9 ()-]{7,20}$/, "Podaj poprawny numer telefonu.").default(""),
    method: z.enum(["bank_transfer", ...PROVIDERS], { errorMap: () => ({ message: "Wybierz dostępną metodę płatności." }) }),
    consent: z.literal(true, { errorMap: () => ({ message: "Zaakceptuj wymagane zgody." }) }),
  }).parse(d))
  .handler(async ({ data }): Promise<{ token: string; redirectUrl?: string } | { error: string }> => {
    const s = await admin();
    const core = await import("./orders.server");
    const { data: item } = await s.from("library_items").select("id, title, access, status, purchasable, price_amount, currency").eq("slug", data.slug).maybeSingle();
    if (!item || item.status !== "published" || item.access !== "premium" || !item.purchasable || !item.price_amount || item.price_amount < 100)
      return { error: "Ten materiał nie jest obecnie dostępny do zakupu." };
    const user = await optionalUser();
    const online = data.method !== "bank_transfer";
    let provider: any = null;
    if (online) {
      const { configStatus } = await import("./payments/providers.server");
      provider = await core.loadProvider(data.method as (typeof PROVIDERS)[number]);
      if (!provider?.enabled || !configStatus(provider).configured) return { error: "Ta metoda płatności jest obecnie niedostępna." };
    }
    const { data: order, error } = await s.from("library_orders").insert({
      item_id: item.id, user_id: user?.id ?? null, buyer_email: data.email, buyer_name: data.name, buyer_phone: data.phone || null,
      amount: item.price_amount, currency: "PLN", status: "pending", provider: online ? data.method : "manual", payment_method: online ? "online" : "bank_transfer",
      environment: online ? provider.environment : "live", consent_text: CONSENT,
    }).select("id, access_token, order_number").single();
    if (error || !order) return { error: "Nie udało się złożyć zamówienia. Spróbuj ponownie." };
    await core.logOrderEvent(order.id, "created", `Zamówienie złożone ${user ? "na koncie" : "bez konta"}, metoda: ${online ? `${PROVIDER_LABEL[data.method]}${provider.environment === "sandbox" ? " (test)" : ""}` : "przelew tradycyjny"}.`);
    await core.notifyOrder(order.id, "order_created");
    await core.notifyOrder(order.id, "order_admin_new");
    if (!online) return { token: order.access_token };
    const { ADAPTERS } = await import("./payments/providers.server");
    const origin = core.siteOrigin();
    const r = await ADAPTERS[data.method as (typeof PROVIDERS)[number]].create(provider, {
      orderId: order.id, orderNumber: order.order_number, amount: item.price_amount, currency: "PLN", email: data.email, name: data.name,
      description: `${order.order_number} — ${item.title}`, returnUrl: `${origin}/zakup/${order.access_token}?powrot=1`,
      notifyUrl: `${origin}/api/public/payments/${data.method}`, customerIp: getRequestIP({ xForwardedFor: true }) ?? "",
    }).catch((e) => ({ ok: false as const, reason: e instanceof Error ? e.message : "error" }));
    if (!r.ok) {
      await core.logOrderEvent(order.id, "checkout_error", `Operator nie utworzył transakcji: ${r.reason}`);
      await s.from("library_orders").update({ status: "failed", failed_at: new Date().toISOString() }).eq("id", order.id).eq("status", "pending");
      return { error: "Nie udało się połączyć z operatorem płatności. Spróbuj ponownie lub wybierz inną metodę." };
    }
    await s.from("library_orders").update({ provider_ref: r.providerRef, checkout_session_id: r.providerRef }).eq("id", order.id);
    await core.logOrderEvent(order.id, "checkout_started", `Transakcja utworzona u operatora (${r.providerRef}). Przekierowanie do płatności.`);
    return { token: order.access_token, redirectUrl: r.redirectUrl };
  });

export const getPurchasedMaterial = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid(), file: z.boolean().default(false) }).parse(d))
  .handler(async ({ data }) => {
    const s = await admin();
    const { hasAccess } = await import("./orders.server");
    const { data: o } = await s.from("library_orders").select("item_id, status, paid_at, access_revoked_at, access_expires_at, order_number, amount, buyer_email, payment_method, provider, library_items(title, slug)").eq("access_token", data.token).maybeSingle();
    if (!o) return { error: "Link jest nieprawidłowy." as const };
    if (!hasAccess(o)) {
      const it = o.library_items as unknown as { title: string; slug: string } | null;
      return { order: { status: o.status, number: o.order_number, amount: o.amount, email: o.buyer_email, title: it?.title ?? "", slug: it?.slug ?? "", method: o.payment_method, provider: PROVIDER_LABEL[o.provider ?? ""] ?? null } };
    }
    if (o.access_expires_at && new Date(o.access_expires_at) < new Date()) return { error: "Link wygasł. Poproś o nowy na stronie materiału." as const };
    const { data: it } = await s.from("library_items").select("title, summary, kind").eq("id", o.item_id).maybeSingle();
    const { data: c } = await s.from("library_item_content").select("body, file_path, file_name, external_url").eq("item_id", o.item_id).maybeSingle();
    if (data.file) {
      if (!c?.file_path) return { error: "Ten materiał nie ma pliku." as const };
      const { data: signed } = await s.storage.from("library-files").createSignedUrl(c.file_path, 300);
      if (!signed) return { error: "Nie udało się przygotować pliku." as const };
      return { url: signed.signedUrl };
    }
    return { item: it, body: c?.body ?? "", hasFile: !!c?.file_path, fileName: c?.file_name ?? null, externalUrl: c?.external_url ?? null, expiresAt: o.access_expires_at };
  });

// Buyer recovery: e-mail + order number → new access message. Always the same answer (no enumeration).
export const recoverAccess = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().toLowerCase().email().max(254), number: z.string().trim().toUpperCase().regex(/^TNB-\d{4}-\d{1,10}$/, "Podaj numer zamówienia, np. TNB-2026-12.") }).parse(d))
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: o } = await s.from("library_orders").select("id").eq("order_number", data.number).eq("buyer_email", data.email).maybeSingle();
    if (o) {
      const { resendAccess } = await import("./orders.server");
      await resendAccess(o.id, `recover-${new Date().toISOString().slice(0, 13)}`);
    }
    return { ok: true };
  });

// Signed-in buyer: purchases linked to the account or to the confirmed account e-mail.
export const listMyPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String((context.claims as any)?.email ?? "").toLowerCase();
    const s = await admin();
    let q = s.from("library_orders").select("id, status, paid_at, amount, access_token, access_revoked_at, library_items(title, slug)").not("paid_at", "is", null).is("access_revoked_at", null).in("status", ["paid", "refund_pending", "refunded"]);
    q = email ? q.or(`user_id.eq.${context.userId},buyer_email.eq.${email}`) : q.eq("user_id", context.userId);
    const { data } = await q.order("paid_at", { ascending: false });
    return (data ?? []).map((o: any) => ({ id: o.id, paid_at: o.paid_at, amount: o.amount, title: o.library_items?.title ?? "", slug: o.library_items?.slug ?? "", token: o.access_token }));
  });

// ---------- admin ----------
const STATUSES = ["pending", "paid", "failed", "cancelled", "refund_pending", "refunded", "needs_review"] as const;

export const adminListOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    q: z.string().trim().max(100).default(""),
    status: z.enum(["all", ...STATUSES]).default("all"),
    provider: z.enum(["all", "manual", ...PROVIDERS]).default("all"),
    from: z.string().max(10).default(""), to: z.string().max(10).default(""),
    kind: z.enum(["all", "real", "test"]).default("all"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("library_orders").select("id, order_number, created_at, paid_at, delivered_at, status, delivery_status, buyer_email, buyer_name, amount, currency, payment_method, provider, environment, is_test, access_revoked_at, library_items!inner(title)").order("created_at", { ascending: false }).limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.provider !== "all") q = q.eq("provider", data.provider);
    if (data.kind !== "all") q = q.eq("is_test", data.kind === "test");
    if (/^\d{4}-\d{2}-\d{2}$/.test(data.from)) q = q.gte("created_at", `${data.from}T00:00:00`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(data.to)) q = q.lte("created_at", `${data.to}T23:59:59`);
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać zamówień.");
    const s = data.q.toLowerCase();
    return (rows as any[]).filter((r) => !s || r.order_number.toLowerCase().includes(s) || r.buyer_email.toLowerCase().includes(s) || (r.buyer_name ?? "").toLowerCase().includes(s) || (r.library_items?.title ?? "").toLowerCase().includes(s));
  });

// Real sales summary: only paid (incl. later refunded) orders, production environment separate from test.
export const adminSalesSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("library_orders").select("status, amount, provider, environment, is_test, paid_at, created_at").limit(20000);
    const rows = (data ?? []) as any[];
    const real = rows.filter((r) => r.environment !== "sandbox" && !r.is_test);
    const paid = real.filter((r) => r.paid_at && ["paid", "refund_pending"].includes(r.status));
    const sum = (a: any[]) => a.reduce((t, r) => t + r.amount, 0);
    const byProvider: Record<string, { count: number; amount: number }> = {};
    for (const r of paid) { const k = r.provider ?? "manual"; byProvider[k] ??= { count: 0, amount: 0 }; byProvider[k].count++; byProvider[k].amount += r.amount; }
    const month = new Date().toISOString().slice(0, 7);
    return {
      paidCount: paid.length, paidAmount: sum(paid), monthAmount: sum(paid.filter((r) => String(r.paid_at).startsWith(month))),
      pending: real.filter((r) => r.status === "pending").length, review: real.filter((r) => r.status === "needs_review").length,
      refunded: real.filter((r) => r.status === "refunded").length, refundedAmount: sum(real.filter((r) => r.status === "refunded")),
      byProvider, testOrders: rows.length - real.length,
    };
  });

export const adminGetOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: o } = await context.supabase.from("library_orders").select("id, order_number, created_at, updated_at, paid_at, delivered_at, cancelled_at, refunded_at, failed_at, status, delivery_status, delivery_error, buyer_email, buyer_name, buyer_phone, amount, currency, payment_method, provider, provider_ref, environment, is_test, user_id, access_expires_at, access_revoked_at, refund_reason, review_reason, paid_marked_by, delivered_marked_by, status_changed_by, status_changed_at, library_items(title, slug)").eq("id", data.id).maybeSingle();
    if (!o) throw new Error("Nie znaleziono zamówienia.");
    const { data: events } = await context.supabase.from("library_order_events").select("type, detail, created_at").eq("order_id", data.id).order("created_at");
    const { data: mails } = await context.supabase.from("email_notification_log").select("kind, template_key, status, reason, created_at").eq("related_id", data.id).order("created_at");
    const ids = [o.paid_marked_by, o.delivered_marked_by, o.status_changed_by].filter(Boolean) as string[];
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: prof } = await (await admin()).auth.admin.listUsers({ perPage: 200 });
      for (const u of prof?.users ?? []) if (ids.includes(u.id)) names[u.id] = u.email ?? u.id;
    }
    const { hasAccess } = await import("./orders.server");
    return { order: o, access: hasAccess(o), events: events ?? [], mails: mails ?? [], names };
  });

export const adminResendDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { resendAccess } = await import("./orders.server");
    const r = await resendAccess(data.id, `admin-${crypto.randomUUID()}`);
    await logEvent({ type: "order_resend", actor: context.userId, objectKind: "order", objectId: data.id, result: r.ok ? "ok" : "failed", detail: r.ok ? undefined : r.reason });
    return r;
  });

export const adminSetOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    action: z.enum(["paid", "delivered", "cancelled", "refund_start", "refund_complete", "review_paid", "review_failed"]),
    reason: z.string().trim().max(500).default(""),
    revokeAccess: z.boolean().default(false),
    confirmNumber: z.string().trim().max(40).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const m = await import("./orders.server");
    if (data.action.startsWith("refund") || data.action.startsWith("review")) {
      const { data: o } = await context.supabase.from("library_orders").select("order_number").eq("id", data.id).maybeSingle();
      if (!o || o.order_number !== data.confirmNumber.toUpperCase()) throw new Error("Wpisz dokładny numer zamówienia, aby potwierdzić.");
    }
    if (data.action === "refund_start" && data.reason.length < 3) throw new Error("Podaj przyczynę zwrotu.");
    const a = data.action;
    const ok = a === "paid" ? await m.markOrderPaid(data.id, context.userId)
      : a === "delivered" ? await m.markOrderDelivered(data.id, context.userId)
      : a === "cancelled" ? await m.cancelOrder(data.id, context.userId)
      : a === "refund_start" ? await m.startRefund(data.id, context.userId, data.reason)
      : a === "refund_complete" ? await m.completeRefund(data.id, context.userId, data.revokeAccess)
      : await m.resolveReview(data.id, context.userId, a === "review_paid" ? "paid" : "failed");
    await logEvent({ type: `order_${a}`, actor: context.userId, objectKind: "order", objectId: data.id, result: ok ? "ok" : "failed", detail: data.reason || undefined });
    if (!ok) throw new Error(a === "paid" ? "Ręcznie można potwierdzić tylko oczekujący przelew tradycyjny. Płatności online potwierdza wyłącznie operator." : "Tej zmiany nie można wykonać przy obecnym statusie zamówienia.");
    return { ok: true };
  });
