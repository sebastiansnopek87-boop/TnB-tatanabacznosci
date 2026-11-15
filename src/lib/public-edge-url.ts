/** Builds a public Edge Function URL for assets whose function validates the reference before returning bytes. */
export function tnbPublicFunctionUrl(functionName: string, params: Record<string, string>): string {
  const base = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  if (!base) return "";
  return `${base.replace(/\/+$/, "")}/functions/v1/${functionName}?${new URLSearchParams(params).toString()}`;
}
