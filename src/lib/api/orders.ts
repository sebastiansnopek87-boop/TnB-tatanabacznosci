import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ProviderId = "p24" | "tpay" | "payu";
type PaymentMethod = "bank_transfer" | ProviderId;
type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "refund_pending" | "refunded" | "needs_review";
type ApiError = { message?: unknown };
type CheckoutProvider = { id: ProviderId; label: string; isDefault: boolean; test: boolean };
type CreateOrderInput = { slug: string; idempotencyKey: string; name: string; email: string; phone?: string; method: PaymentMethod; consent: true };
type PurchasedMaterial =
  | { error: string }
  | { order: { status: OrderStatus; number: string; amount: number; email: string; title: string; slug: string; method: string; provider: string | null } }
  | { item: { title: string; summary: string | null; kind: string } | null; body: string; hasFile: boolean; fileName: string | null; externalUrl: string | null; expiresAt: string | null }
  | { url: string };
type MyPurchase = { id: string; paid_at: string; amount: number; title: string; slug: string; token: string };
type AdminOrderRow = {
  id: string; order_number: string; created_at: string; paid_at: string | null; delivered_at: string | null;
  status: OrderStatus; delivery_status: string; buyer_email: string; buyer_name: string; amount: number; currency: string;
  payment_method: string; provider: string; environment: string; is_test: boolean; access_revoked_at: string | null;
  library_items: { title: string };
};
type OrderDetail = {
  order: Tables<"library_orders"> & { library_items: { title: string; slug: string } | null };
  access: boolean;
  events: Array<{ type: string; detail: string | null; created_at: string }>;
  mails: Array<{ kind: string; template_key: string | null; status: string; reason: string | null; created_at: string }>;
  names: Record<string, string>;
};
type AdminListFilter = {
  q?: string; status?: "all" | OrderStatus; provider?: "all" | "manual" | ProviderId;
  from?: string; to?: string; kind?: "all" | "real" | "test";
};
type StatusAction = "paid" | "delivered" | "cancelled" | "refund_start" | "refund_complete" | "review_paid" | "review_failed";

const AUTHENTICATED_ORDER_ACTIONS = new Set([
  "listMyPurchases",
  "adminListOrders",
  "adminSalesSummary",
  "adminGetOrder",
  "adminResendDelivery",
  "adminSetOrderStatus",
]);

async function invokeOrders<T>(action: string, data?: unknown): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (AUTHENTICATED_ORDER_ACTIONS.has(action) && (sessionError || !token)) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }
  const body = data === undefined ? { action } : { action, data };
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-orders", {
    body,
    headers: token ? { Authorization: "Bearer " + token } : {},
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z obsługą zamówień.");
  }
  if (result === null) throw new Error("Usługa zamówień zwróciła pustą odpowiedź.");
  return result as T;
}

export function getCheckoutOptions(): Promise<{ providers: CheckoutProvider[] }> {
  return invokeOrders("getCheckoutOptions");
}
export function createLibraryOrder({ data }: { data: CreateOrderInput }): Promise<{ token: string; redirectUrl?: string; processing?: boolean; replayed?: boolean } | { error: string }> {
  return invokeOrders("createLibraryOrder", data);
}
export function getPurchasedMaterial({ data }: { data: { token: string; file?: boolean } }): Promise<PurchasedMaterial> {
  return invokeOrders("getPurchasedMaterial", data);
}
export function recoverAccess({ data }: { data: { email: string; number: string } }): Promise<{ ok: true }> {
  return invokeOrders("recoverAccess", data);
}
export function listMyPurchases(): Promise<MyPurchase[]> {
  return invokeOrders("listMyPurchases");
}
export function adminListOrders({ data }: { data: AdminListFilter }): Promise<AdminOrderRow[]> {
  return invokeOrders("adminListOrders", data);
}
export function adminSalesSummary(): Promise<{
  paidCount: number; paidAmount: number; monthAmount: number; pending: number; review: number; refunded: number;
  refundedAmount: number; byProvider: Record<string, { count: number; amount: number }>; testOrders: number;
}> {
  return invokeOrders("adminSalesSummary");
}
export function adminGetOrder({ data }: { data: { id: string } }): Promise<OrderDetail> {
  return invokeOrders("adminGetOrder", data);
}
export function adminResendDelivery({ data }: { data: { id: string } }): Promise<{ ok: boolean; reason?: string }> {
  return invokeOrders("adminResendDelivery", data);
}
export function adminSetOrderStatus({ data }: { data: {
  id: string; action: StatusAction; reason?: string; revokeAccess?: boolean; confirmNumber?: string;
} }): Promise<{ ok: true }> {
  return invokeOrders("adminSetOrderStatus", data);
}
