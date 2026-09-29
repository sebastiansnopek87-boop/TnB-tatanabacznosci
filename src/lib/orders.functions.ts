import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CONSENT = "Akceptuję Regulamin i Politykę prywatności. Wyrażam zgodę na przetwarzanie imienia, nazwiska i adresu e-mail w celu realizacji zamówienia i dostarczenia materiału.";
const envSchema = z.enum(["sandbox", "live"]);
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

async function optionalUser() {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.split(".").length !== 3) return null;
  const { data } = await (await admin()).auth.getUser(token);
  return data.user ?? null;
}

type StartResult = { clientSecret: string; orderId: string } | { error: string };

export const startLibraryCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
    name: z.string().trim().min(3, "Podaj imię i nazwisko.").max(120),
    email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
    consent: z.literal(true, { errorMap: () => ({ message: "Zaakceptuj wymagane zgody." }) }),
    environment: envSchema,
    origin: z.string().url().max(200),
  }).parse(d))
  .handler(async ({ data }): Promise<StartResult> => {
    const s = await admin();
    const { logOrderEvent, sendOrderMail } = await import("./orders.server");
    const { createStripeClient, getStripeErrorMessage } = await import("./stripe.server");
    const { data: item } = await s.from("library_items").select("id, title, access, status, purchasable, price_amount, currency").eq("slug", data.slug).maybeSingle();
    if (!item || item.status !== "published" || item.access !== "premium" || !item.purchasable || !item.price_amount || item.price_amount < 100)
      return { error: "Ten materiał nie jest obecnie dostępny do zakupu." };
    const origin = new URL(data.origin).origin;
    const user = await optionalUser();
    const { data: order, error } = await s.from("library_orders").insert({
      item_id: item.id, user_id: user?.id ?? null, buyer_email: data.email, buyer_name: data.name,
      amount: item.price_amount, currency: item.currency || "PLN", status: "pending", provider: "stripe",
      environment: data.environment, consent_text: CONSENT,
    }).select("id").single();
    if (error || !order) return { error: "Nie udało się utworzyć zamówienia." };
    await logOrderEvent(order.id, "created", `Zamówienie utworzone${user ? " (konto)" : " (bez konta)"}.`);
    try {
      const stripe = createStripeClient(data.environment);
      let customer: string | undefined;
      if (user) {
        const found = await stripe.customers.search({ query: `metadata['userId']:'${user.id}'`, limit: 1 });
        customer = found.data[0]?.id ?? (await stripe.customers.create({ email: data.email, name: data.name, metadata: { userId: user.id } })).id;
      }
      const session = await stripe.checkout.sessions.create(({
        mode: "payment", ui_mode: "embedded_page",
        line_items: [{ quantity: 1, price_data: { currency: (item.currency || "PLN").toLowerCase(), unit_amount: item.price_amount, product_data: { name: item.title, tax_code: "txcd_10000000" } } }],
        return_url: `${origin}/zakup/wynik?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
        client_reference_id: order.id,
        ...(customer ? { customer } : { customer_email: data.email }),
        payment_intent_data: { description: item.title, metadata: { order_id: order.id } },
        metadata: { order_id: order.id, item_id: item.id, managed_payments: "true", ...(user ? { userId: user.id } : {}) },
        managed_payments: { enabled: true },
      }) as unknown as Stripe.Checkout.SessionCreateParams);
      await s.from("library_orders").update({ checkout_session_id: session.id }).eq("id", order.id);
      await logOrderEvent(order.id, "checkout_started", "Rozpoczęto płatność.");
      await sendOrderMail(order.id, "order_received");
      return { clientSecret: session.client_secret ?? "", orderId: order.id };
    } catch (e) {
      const msg = getStripeErrorMessage(e);
      await s.from("library_orders").update({ status: "failed", failed_at: new Date().toISOString() }).eq("id", order.id);
      await logOrderEvent(order.id, "checkout_error", msg);
      return { error: `Nie udało się rozpocząć płatności: ${msg}` };
    }
  });

// Buyer closed the payment form: expire the session at the operator. Only if
// the operator accepts the expiry (i.e. not paid) do we mark it cancelled.
export const cancelLibraryCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), environment: envSchema }).parse(d))
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: o } = await s.from("library_orders").select("checkout_session_id, status").eq("id", data.orderId).maybeSingle();
    if (!o?.checkout_session_id || o.status !== "pending") return { ok: false };
    try {
      const { createStripeClient } = await import("./stripe.server");
      await createStripeClient(data.environment).checkout.sessions.expire(o.checkout_session_id);
      const { markOrderStatus } = await import("./orders.server");
      await markOrderStatus(data.orderId, "cancelled", "Kupujący przerwał płatność.");
      return { ok: true };
    } catch { return { ok: false }; }
  });

// Readable only with the matching operator session id (unguessable, from the return URL).
export const getOrderResult = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), sessionId: z.string().min(10).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: o } = await s.from("library_orders").select("status, access_token, delivery_status, buyer_email, amount, library_items(title, slug)")
      .eq("id", data.orderId).eq("checkout_session_id", data.sessionId).maybeSingle();
    if (!o) return null;
    const it = o.library_items as unknown as { title: string; slug: string } | null;
    return { status: o.status, delivery: o.delivery_status, email: o.buyer_email, amount: o.amount, title: it?.title ?? "", slug: it?.slug ?? "", token: o.status === "paid" ? o.access_token : null };
  });

export const getPurchasedMaterial = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid(), file: z.boolean().default(false) }).parse(d))
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: o } = await s.from("library_orders").select("item_id, status, access_expires_at").eq("access_token", data.token).maybeSingle();
    if (!o || o.status !== "paid") return { error: "Link jest nieprawidłowy albo zamówienie nie zostało opłacone." as const };
    if (o.access_expires_at && new Date(o.access_expires_at) < new Date()) return { error: "Link wygasł. Skontaktuj się z nami, a wyślemy nowy." as const };
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

export const listMyPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("library_orders").select("id, status, paid_at, amount, library_items(title, slug)")
      .eq("user_id", context.userId).eq("status", "paid").order("paid_at", { ascending: false });
    return (data ?? []).map((o: any) => ({ id: o.id, paid_at: o.paid_at, amount: o.amount, title: o.library_items?.title ?? "", slug: o.library_items?.slug ?? "" }));
  });

// ---------- admin ----------
type Ctx = { supabase: any; userId: string };
async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Brak uprawnień administratora.");
}

export const adminListOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    q: z.string().trim().max(100).default(""),
    status: z.enum(["all", "pending", "paid", "failed", "cancelled", "refunded", "delivered"]).default("all"),
    from: z.string().max(10).default(""), to: z.string().max(10).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("library_orders").select("id, created_at, paid_at, delivered_at, status, delivery_status, buyer_email, buyer_name, amount, currency, environment, library_items!inner(title)").order("created_at", { ascending: false }).limit(300);
    if (data.status === "delivered") q = q.not("delivered_at", "is", null);
    else if (data.status !== "all") q = q.eq("status", data.status);
    if (/^\d{4}-\d{2}-\d{2}$/.test(data.from)) q = q.gte("created_at", `${data.from}T00:00:00`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(data.to)) q = q.lte("created_at", `${data.to}T23:59:59`);
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać zamówień.");
    const s = data.q.toLowerCase();
    return (rows as any[]).filter((r) => !s || r.id.includes(s) || r.id.slice(0, 8).toLowerCase() === s || r.buyer_email.toLowerCase().includes(s) || (r.library_items?.title ?? "").toLowerCase().includes(s));
  });

export const adminGetOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: o } = await context.supabase.from("library_orders").select("id, created_at, paid_at, delivered_at, failed_at, cancelled_at, refunded_at, status, delivery_status, delivery_error, buyer_email, buyer_name, amount, currency, environment, provider, provider_ref, user_id, access_expires_at, library_items(title, slug)").eq("id", data.id).maybeSingle();
    if (!o) throw new Error("Nie znaleziono zamówienia.");
    const { data: events } = await context.supabase.from("library_order_events").select("type, detail, created_at").eq("order_id", data.id).order("created_at");
    const { data: mails } = await context.supabase.from("email_notification_log").select("kind, status, reason, created_at").eq("related_id", data.id).order("created_at");
    return { order: o, events: events ?? [], mails: mails ?? [] };
  });

export const adminResendDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { deliverOrder } = await import("./orders.server");
    const r = await deliverOrder(data.id, "admin");
    return r.ok ? { ok: true as const } : { ok: false as const, reason: r.reason };
  });
