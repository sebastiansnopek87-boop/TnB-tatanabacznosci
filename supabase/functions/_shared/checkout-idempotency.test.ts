import { assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert";
import { checkoutFingerprint, type CheckoutFingerprintInput } from "./checkout-idempotency.ts";

const base: CheckoutFingerprintInput = {
  itemId: "00000000-0000-4000-8000-000000000001",
  method: "p24",
  email: "buyer@example.com",
  name: "Jan Kowalski",
  phone: "",
  amount: 1299,
  currency: "PLN",
  userId: null,
};

Deno.test("checkout fingerprint is stable and normalized", async () => {
  const first = await checkoutFingerprint(base);
  const second = await checkoutFingerprint({ ...base, email: " BUYER@example.com ", name: " Jan Kowalski " });
  assertEquals(first, second);
  assertMatch(first, /^[0-9a-f]{64}$/);
});

Deno.test("checkout fingerprint changes when payment intent changes", async () => {
  const original = await checkoutFingerprint(base);
  assertNotEquals(original, await checkoutFingerprint({ ...base, amount: 1300 }));
  assertNotEquals(original, await checkoutFingerprint({ ...base, method: "tpay" }));
  assertNotEquals(original, await checkoutFingerprint({ ...base, itemId: "00000000-0000-4000-8000-000000000002" }));
});
