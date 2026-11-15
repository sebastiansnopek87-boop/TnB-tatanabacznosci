import { supabase } from "@/integrations/supabase/client";

type EdgeFailure = { message?: unknown };

export async function invokeEdge<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(functionName, { body });

  if (error) {
    const response = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      const failure = await response.clone().json().catch(() => null) as EdgeFailure | null;
      if (typeof failure?.message === "string") throw new Error(failure.message);
    }
    throw error;
  }

  return data as T;
}
