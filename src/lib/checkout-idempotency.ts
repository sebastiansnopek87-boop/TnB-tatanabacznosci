export type CheckoutKeyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getOrCreateCheckoutKey(
  storage: CheckoutKeyStorage,
  storageKey: string,
  createKey: () => string,
): string {
  const existing = storage.getItem(storageKey);
  if (existing && UUID_PATTERN.test(existing)) return existing;

  const key = createKey();
  if (!UUID_PATTERN.test(key)) throw new Error("Checkout key generator returned an invalid UUID.");
  storage.setItem(storageKey, key);
  return key;
}

export function clearCheckoutKey(storage: CheckoutKeyStorage, storageKey: string): void {
  storage.removeItem(storageKey);
}

export function shouldClearCheckoutKey(status: string): boolean {
  return status === "paid" || status === "failed" || status === "cancelled" || status === "refunded";
}
