import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type EdgeErrorPayload = {
  error?: string;
  message?: string;
};

function isEdgeErrorPayload(value: unknown): value is EdgeErrorPayload {
  return !!value && typeof value === "object";
}

/** Invoke a TNB Edge Function with the current Supabase session. Never uses a service key in the browser. */
export async function invokeEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const functions = supabase.functions as unknown as {
    invoke<T>(functionName: string, options: { body: Record<string, unknown> }): Promise<{ data: T | null; error: Error | null }>;
  };
  const { data, error } = await functions.invoke<T>(name, { body });

  if (error instanceof FunctionsHttpError) {
    let payload: EdgeErrorPayload | undefined;
    try {
      const parsed: unknown = await error.context.clone().json();
      if (isEdgeErrorPayload(parsed)) payload = parsed;
    } catch {
      // The function may return a non-JSON error response.
    }

    const message = payload?.message || error.message || "Wystąpił błąd usługi.";
    const failure = new Error(message);
    Object.assign(failure, {
      code: payload?.error ?? "edge_function_error",
      status: error.context.status,
    });
    throw failure;
  }

  if (error instanceof FunctionsRelayError) {
    throw new Error("Supabase nie przekazał żądania do funkcji. Spróbuj ponownie.");
  }

  if (error instanceof FunctionsFetchError) {
    throw new Error("Nie udało się połączyć z usługą Supabase. Sprawdź połączenie z internetem.");
  }

  if (error) throw error;
  return data as T;
}
