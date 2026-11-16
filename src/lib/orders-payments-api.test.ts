import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getSession } = vi.hoisted(() => ({
  invoke: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession }, functions: { invoke } },
}));

import {
  adminGetOrder,
  adminListOrders,
  adminResendDelivery,
  adminSalesSummary,
  adminSetOrderStatus,
  createLibraryOrder,
  getCheckoutOptions,
  getPurchasedMaterial,
  listMyPurchases,
  recoverAccess,
} from "./api/orders";
import {
  listPaymentProviders,
  setPaymentEnvironment,
  testPaymentProvider,
  updatePaymentProvider,
} from "./api/payments";

const orderActions = [
  "getCheckoutOptions",
  "createLibraryOrder",
  "getPurchasedMaterial",
  "recoverAccess",
  "listMyPurchases",
  "adminListOrders",
  "adminSalesSummary",
  "adminGetOrder",
  "adminResendDelivery",
  "adminSetOrderStatus",
] as const;
const paymentActions = [
  "listPaymentProviders",
  "updatePaymentProvider",
  "setPaymentEnvironment",
  "testPaymentProvider",
] as const;
const id = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  getSession.mockReset().mockResolvedValue({
    data: { session: { access_token: "user-access-token" } },
    error: null,
  });
});

describe("orders and payments SPA adapter contracts", () => {
  it("keeps every order action in the legacy contract and Edge Function", () => {
    const legacy = readFileSync(new URL("./orders.functions.ts", import.meta.url), "utf8");
    const edge = readFileSync(new URL("../../supabase/functions/tnb-orders/index.ts", import.meta.url), "utf8");
    for (const action of orderActions) {
      expect(legacy).toContain("export const " + action + " =");
      expect(edge).toContain('case "' + action + '":');
    }
  });

  it("keeps every payment administration action in the legacy contract and Edge Function", () => {
    const legacy = readFileSync(new URL("./payments.functions.ts", import.meta.url), "utf8");
    const edge = readFileSync(new URL("../../supabase/functions/tnb-payments/index.ts", import.meta.url), "utf8");
    for (const action of paymentActions) {
      expect(legacy).toContain("export const " + action + " =");
      expect(edge).toContain('case "' + action + '":');
    }
  });

  it("sends all order operations to tnb-orders with the established action and payload", async () => {
    await Promise.all([
      getCheckoutOptions(),
      createLibraryOrder({ data: { slug: "material-premium", name: "Jan Kowalski", email: "jan@example.com", method: "p24", consent: true } }),
      getPurchasedMaterial({ data: { token: id, file: true } }),
      recoverAccess({ data: { email: "jan@example.com", number: "TNB-2026-12" } }),
      listMyPurchases(),
      adminListOrders({ data: { q: "TNB", status: "all", provider: "all", from: "", to: "", kind: "all" } }),
      adminSalesSummary(),
      adminGetOrder({ data: { id } }),
      adminResendDelivery({ data: { id } }),
      adminSetOrderStatus({ data: { id, action: "refund_start", reason: "Zwrot" } }),
    ]);

    expect(invoke).toHaveBeenCalledTimes(orderActions.length);
    for (const action of orderActions) {
      expect(invoke).toHaveBeenCalledWith("tnb-orders", {
        body: action === "getCheckoutOptions" || action === "listMyPurchases" || action === "adminSalesSummary"
          ? { action }
          : expect.objectContaining({ action, data: expect.any(Object) }),
        headers: { Authorization: "Bearer user-access-token" },
      });
    }
  });

  it("sends all payment administration operations to tnb-payments", async () => {
    await Promise.all([
      listPaymentProviders(),
      updatePaymentProvider({ data: { id: "p24", enabled: false, isDefault: false, merchant_id: "", pos_id: "", client_id: "" } }),
      setPaymentEnvironment({ data: { id: "p24", environment: "sandbox", confirm: "" } }),
      testPaymentProvider({ data: { id: "payu" } }),
    ]);

    expect(invoke).toHaveBeenCalledTimes(paymentActions.length);
    for (const action of paymentActions) {
      expect(invoke).toHaveBeenCalledWith("tnb-payments", {
        body: action === "listPaymentProviders"
          ? { action }
          : expect.objectContaining({ action, data: expect.any(Object) }),
        headers: { Authorization: "Bearer user-access-token" },
      });
    }
  });

  it("does not call payment administration without an authenticated session", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(listPaymentProviders()).rejects.toThrow("Sesja wygasła");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("preserves server error messages and rejects empty responses", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge Function returned a non-2xx status code", context: new Response(JSON.stringify({ message: "Brak uprawnień administratora." }), { status: 403 }) },
    });
    await expect(testPaymentProvider({ data: { id: "p24" } })).rejects.toThrow("Brak uprawnień administratora.");

    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(getCheckoutOptions()).rejects.toThrow("pusta odpowiedź");
  });
});
