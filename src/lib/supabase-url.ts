export function getSupabaseBaseUrl(): string {
  const value = import.meta.env["VITE_SUPABASE_URL"];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Brak konfiguracji VITE_SUPABASE_URL.");
  }
  return value.replace(/\/+$/, "");
}
