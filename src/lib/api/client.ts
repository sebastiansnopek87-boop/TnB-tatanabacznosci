import { supabase } from "@/integrations/supabase/client";

type EdgeErrorPayload = {
  error?: string;
  message?: string;
};

export class TnbApiError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, options: { code?: string; status?: number } = {}) {
    super(message);
    this.name = "TnbApiError";
    this.code = options.code;
    this.status = options.status;
  }
}

/**
 * Calls a deployed TNB Edge Function using the current Supabase session.
 * The publishable key and the user's access token are added by supabase-js.
 * Never pass a service-role key or another privileged credential from the browser.
 */
export async function invokeTnbFunction<TResult>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<TResult> {
  const { data, error } = await supabase.functions.invoke<TResult>(functionName, { body });

  if (error) {
    const context = "context" in error ? error.context : undefined;

    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as EdgeErrorPayload | null;
      throw new TnbApiError(
        payload?.message || error.message || "Wystąpił błąd usługi.",
        { code: payload?.error, status: context.status },
      );
    }

    throw new TnbApiError(error.message || "Nie udało się połączyć z usługą.");
  }

  if (data === null) {
    throw new TnbApiError("Usługa zwróciła pustą odpowiedź.");
  }

  return data;
}
