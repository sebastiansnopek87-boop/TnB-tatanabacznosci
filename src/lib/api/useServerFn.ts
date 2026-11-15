// Transitional adapter for browser-safe API functions.
// Existing UI can keep the useServerFn call shape while its implementation
// is migrated from TanStack Start server functions to Supabase Edge Functions.
export function useServerFn<T extends (...args: any[]) => any>(fn: T): T {
  return fn;
}
