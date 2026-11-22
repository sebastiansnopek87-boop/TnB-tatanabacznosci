export type CheckoutFingerprintInput = {
  itemId: string;
  method: "p24" | "tpay" | "payu";
  email: string;
  name: string;
  phone: string;
  amount: number;
  currency: string;
  userId: string | null;
};

export async function checkoutFingerprint(input: CheckoutFingerprintInput): Promise<string> {
  const canonical = JSON.stringify({
    itemId: input.itemId,
    method: input.method,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    phone: input.phone.trim(),
    amount: input.amount,
    currency: input.currency,
    userId: input.userId,
  });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
