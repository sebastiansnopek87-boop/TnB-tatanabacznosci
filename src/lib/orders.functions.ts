import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CONSENT = "Akceptuję Regulamin i Politykę prywatności. Wyrażam zgodę na przetwarzanie imienia, nazwiska, adresu e-mail i (opcjonalnie) numeru telefonu w celu realizacji zamówienia i dostarczenia materiału.";
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

async function optionalUser() {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.split(".").length !== 3) return null;
  const { data } = await (await admin()).auth.getUser(token);
  return data.user ?? null;
}

// Creates a pending bank-transfer order. Price always comes from the database.
export const createLibraryOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
    name: z.string().trim().min(3, "Podaj imię i nazwisko.").max(120),
    email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
    phone: z.string().trim().max(20).regex(/^$|^\+?[0-9 ()-]{7,20}$/, "Podaj poprawny numer telefonu.").default(""),
    method: z.literal("bank_transfer", { errorMap: () => ({ message: "Wybierz dostępną metodę płatności." }) }),
    consent: z.literal(true, { errorMap: () => ({ message: "Zaakceptuj wymagane zgody." }) }),
  }).parse(d))
  .handler(async ({ data }): Promise<{ token: string } | { error: string }> => {
    const s = await admin();
    const { logOrderEvent, sendOrderMail } = await import("./orders.server");
    const { data: item } = await s.from("library_items").select("id, access, status, purchasable, price_amount, currency").eq("slug", data.slug).maybeSingle();
    if (!item || item.status !== "published" || item.access !== "premium" || !item.purchasable || !item.price_amount || item.price_amount < 100)
      return { error: "Ten materiał nie jest obecnie dostępny do zakupu." };
    const user = await optionalUser();
    const { data: order, error } = await s.from("library_orders").insert({
      item_id: item.id, user_id: user?.id ?? null, buyer_email: data.email, buyer_name: data.name, buyer_phone: data.phone || null,
      amount: item.price_amount, currency: "PLN", status: "pending", provider: "manual", payment_method: "bank_transfer",
      environment: "live", consent_text: CONSENT,
    }).select("id, access_token").single();
    if (error || !order) return { error: "Nie udało się złożyć zamówienia. Spróbuj ponownie." };
    await logOrderEvent(order.id, "created", `Zamówienie złożone${user ? " (konto)" : " (bez konta)"}, przelew tradycyjny.`);
    await sendOrderMail(order.id, "order_received");
    return { token: order.access_token };
  });

export const getPurchasedMaterial = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid(), file: z.boolean().default(false) }).parse(d))
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: o } = await s.from("library_orders").select("item_id, status, access_expires_at, order_number, amount, buyer_email, library_items(title, slug)").eq("access_token", data.token).maybeSingle();
    if (!o) return { error: "Link jest nieprawidłowy." as const };
    if (o.status !== "paid") {
      const it = o.library_items as unknown as { title: string; slug: string } | null;
      return { order: { status: o.status, number: o.order_number, amount: o.amount, email: o.buyer_email, title: it?.title ?? "", slug: it?.slug ?? "" } };
    }
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
    status: z.enum(["all", "pending", "paid", "cancelled", "refunded", "delivered"]).default("all"),
    from: z.string().max(10).default(""), to: z.string().max(10).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("library_orders").select("id, order_number, created_at, paid_at, delivered_at, status, delivery_status, buyer_email, buyer_name, amount, currency, payment_method, library_items!inner(title)").order("created_at", { ascending: false }).limit(300);
    if (data.status === "delivered") q = q.not("delivered_at", "is", null);
    else if (data.status === "paid") q = q.eq("status", "paid").is("delivered_at", null);
    else if (data.status !== "all") q = q.eq("status", data.status);
    if (/^\d{4}-\d{2}-\d{2}$/.test(data.from)) q = q.gte("created_at", `${data.from}T00:00:00`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(data.to)) q = q.lte("created_at", `${data.to}T23:59:59`);
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać zamówień.");
    const s = data.q.toLowerCase();
    return (rows as any[]).filter((r) => !s || r.order_number.toLowerCase().includes(s) || r.buyer_email.toLowerCase().includes(s) || (r.buyer_name ?? "").toLowerCase().includes(s) || (r.library_items?.title ?? "").toLowerCase().includes(s));
  });

export const adminGetOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: o } = await context.supabase.from("library_orders").select("id, order_number, created_at, updated_at, paid_at, delivered_at, cancelled_at, refunded_at, status, delivery_status, delivery_error, buyer_email, buyer_name, buyer_phone, amount, currency, payment_method, user_id, access_expires_at, paid_marked_by, delivered_marked_by, status_changed_by, status_changed_at, library_items(title, slug)").eq("id", data.id).maybeSingle();
    if (!o) throw new Error("Nie znaleziono zamówienia.");
    const { data: events } = await context.supabase.from("library_order_events").select("type, detail, created_at").eq("order_id", data.id).order("created_at");
    const { data: mails } = await context.supabase.from("email_notification_log").select("kind, status, reason, created_at").eq("related_id", data.id).order("created_at");
    const ids = [o.paid_marked_by, o.delivered_marked_by, o.status_changed_by].filter(Boolean) as string[];
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: prof } = await (await admin()).auth.admin.listUsers({ perPage: 200 });
      for (const u of prof?.users ?? []) if (ids.includes(u.id)) names[u.id] = u.email ?? u.id;
    }
    return { order: o, events: events ?? [], mails: mails ?? [], names };
  });

export const adminResendDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { deliverOrder } = await import("./orders.server");
    const r = await deliverOrder(data.id, "admin", context.userId);
    return r.ok ? { ok: true as const } : { ok: false as const, reason: r.reason };
  });

export const adminSetOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), action: z.enum(["paid", "delivered", "cancelled", "refunded"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const m = await import("./orders.server");
    const ok = data.action === "paid" ? await m.markOrderPaid(data.id, context.userId)
      : data.action === "delivered" ? await m.markOrderDelivered(data.id, context.userId)
      : await m.markOrderStatus(data.id, data.action, data.action === "cancelled" ? "Anulowane przez administratora." : "Zwrot oznaczony przez administratora.", context.userId);
    if (!ok) throw new Error("Tej zmiany nie można wykonać przy obecnym statusie zamówienia.");
    return { ok: true };
  });
