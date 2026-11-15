// Transitional adapter for browser-safe API functions.
export function useServerFn<T>(fn: T): T {
  return fn;
}
