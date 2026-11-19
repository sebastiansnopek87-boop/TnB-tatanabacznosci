import { assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert";
import { checkoutFingerprint, type CheckoutFingerprintInput } from "./checkout-idempotency.ts";

const base: CheckoutFingerprintInput = {
  itemId: "00000000-0000-4000-8000-000000000001",
  method: "p24",
  email: "buyer@example.com",
  name: "Jan Kowalski",
  phone: "+48123123123",
  amount: 1299,
  currency: "PLN",
  userId: null,
};

Deno.test("checkout fingerprint is stable and normalizes buyer fields", async () => {
  const first = await checkoutFingerprint(base);
  const second = await checkoutFingerprint({
    ...base,
    email: " BUYER@example.com ",
    name: " Jan Kowalski ",
    phone: " +48123123123 ",
  });
  assertEquals(first, second);
  assertMatch(first, /^[0-9a-f]{64}$/);
});

Deno.test("checkout fingerprint changes when any payment intent field changes", async () => {
  const original = await checkoutFingerprint(base);
  const variants: CheckoutFingerprintInput[] = [
    { ...base, itemId: "00000000-0000-4000-8000-000000000002" },
    { ...base, method: "tpay" },
    { ...base, email: "other@example.com" },
    { ...base, name: "Anna Kowalska" },
    { ...base, phone: "+48987654321" },
    { ...base, amount: 1300 },
    { ...base, currency: "EUR" },
    { ...base, userId: "00000000-0000-4000-8000-000000000099" },
  ];
  for (const variant of variants) {
    assertNotEquals(original, await checkoutFingerprint(variant));
  }
});
