import { describe, expect, it } from "vitest";
import { clearCheckoutKey, getOrCreateCheckoutKey, type CheckoutKeyStorage } from "./checkout-idempotency";

function createMemoryStorage(): CheckoutKeyStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe("checkout idempotency key persistence", () => {
  it("reuses a valid key after a remount or page reload", () => {
    const storage = createMemoryStorage();
    const key = "11111111-1111-4111-8111-111111111111";
    const createKey = () => key;

    expect(getOrCreateCheckoutKey(storage, "tnb:checkout:material", createKey)).toBe(key);
    expect(getOrCreateCheckoutKey(storage, "tnb:checkout:material", () => {
      throw new Error("A persisted key should be reused.");
    })).toBe(key);
  });

  it("replaces invalid stored values with a fresh UUID", () => {
    const values = new Map<string, string>([["checkout", "not-a-uuid"]]);
    const storage: CheckoutKeyStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    };
    const fresh = "22222222-2222-4222-8222-222222222222";
    expect(getOrCreateCheckoutKey(storage, "checkout", () => fresh)).toBe(fresh);
    expect(values.get("checkout")).toBe(fresh);
  });

  it("clears the key only when the checkout has completed", () => {
    const storage = createMemoryStorage();
    const key = "33333333-3333-4333-8333-333333333333";
    getOrCreateCheckoutKey(storage, "checkout", () => key);
    clearCheckoutKey(storage, "checkout");
    expect(storage.getItem("checkout")).toBeNull();
  });
});
