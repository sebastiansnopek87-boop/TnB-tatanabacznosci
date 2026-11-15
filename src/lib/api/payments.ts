import { supabase } from "@/integrations/supabase/client";

type ProviderId = "p24" | "tpay" | "payu";
type Environment = "sandbox" | "live";
type ApiError = { message?: unknown };
type ProviderFields = { key: "merchant_id" | "pos_id" | "client_id"; label: string };
type ProviderSecret = { name: string; label: string; set: boolean };
type ProviderRow = {
  id: ProviderId; enabled: boolean; is_default: boolean; environment: Environment;
  merchant_id: string | null; pos_id: string | null; client_id: string | null;
  label: string; fields: ProviderFields[]; docs: string; refunds: string; webhookUrl: string;
  status: { configured: boolean; missing: string[]; secrets: ProviderSecret[] };
  last_test_at: string | null; last_test_ok: boolean | null; last_test_detail: string | null;
};
async function invokePayments<T>(action: string, data?: unknown): Promise<T> {
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (sessionError || !token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  const { data: result, error } = await supabase.functions.invoke<T>("tnb-payments", {
    body: data === undefined ? { action } : { action, data },
    headers: { Authorization: "Bearer " + token },
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      const payload = (await context.clone().json().catch(() => null)) as ApiError | null;
      if (typeof payload?.message === "string" && payload.message.trim()) throw new Error(payload.message);
    }
    throw new Error(error.message || "Nie udało się połączyć z operatorem płatności.");
  }
  if (result === null) throw new Error("Usługa płatności zwróciła pustą odpowiedź.");
  return result as T;
}
export function listPaymentProviders(): Promise<{ canEdit: boolean; providers: ProviderRow[] }> {
  return invokePayments("listPaymentProviders");
}
export function updatePaymentProvider({ data }: { data: {
  id: ProviderId; enabled: boolean; isDefault: boolean; merchant_id: string; pos_id: string; client_id: string;
} }): Promise<{ ok: true }> {
  return invokePayments("updatePaymentProvider", data);
}
export function setPaymentEnvironment({ data }: { data: { id: ProviderId; environment: Environment; confirm: string } }): Promise<{ ok: true }> {
  return invokePayments("setPaymentEnvironment", data);
}
export function testPaymentProvider({ data }: { data: { id: ProviderId } }): Promise<{ ok: boolean; detail: string }> {
  return invokePayments("testPaymentProvider", data);
}
