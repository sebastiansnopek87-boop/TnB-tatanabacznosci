import { describe, expect, it } from "vitest";
import { p24VerificationSucceeded, providerReferenceMatches, tpayTransactionReference } from "../../supabase/functions/_shared/payment-webhook";

describe("payment webhook provider reference guard", () => {
  it("accepts the exact transaction reference saved at checkout", () => {
    expect(providerReferenceMatches("p24-session-uuid", "p24-session-uuid")).toBe(true);
    expect(providerReferenceMatches("TR-CWM-CS7LW1X", "TR-CWM-CS7LW1X")).toBe(true);
    expect(providerReferenceMatches("PAYU-ORDER-123", "PAYU-ORDER-123")).toBe(true);
  });

  it("rejects missing, empty, malformed and different references", () => {
    expect(providerReferenceMatches(null, "provider-ref")).toBe(false);
    expect(providerReferenceMatches("provider-ref", null)).toBe(false);
    expect(providerReferenceMatches("", "provider-ref")).toBe(false);
    expect(providerReferenceMatches("provider-ref", "")).toBe(false);
    expect(providerReferenceMatches("provider-ref", "attacker-ref")).toBe(false);
    expect(providerReferenceMatches("ABC", "abc")).toBe(false);
  });
});

describe("P24 verification gate", () => {
  it("accepts only a successful HTTP response with provider status success", () => {
    expect(p24VerificationSucceeded(true, "success")).toBe(true);
    expect(p24VerificationSucceeded(false, "success")).toBe(false);
    expect(p24VerificationSucceeded(true, "pending")).toBe(false);
    expect(p24VerificationSucceeded(true, undefined)).toBe(false);
  });
});


describe("Tpay transaction reference", () => {
  it("uses the Tpay transaction title that is echoed as tr_id", () => {
    expect(tpayTransactionReference("TR-BRA-KGZK0X")).toBe("TR-BRA-KGZK0X");
    expect(tpayTransactionReference(" TR-BRA-KGZK0X ")).toBe("TR-BRA-KGZK0X");
  });

  it("fails closed when the transaction title is missing instead of falling back to unrelated IDs", () => {
    expect(tpayTransactionReference(undefined)).toBeNull();
    expect(tpayTransactionReference(null)).toBeNull();
    expect(tpayTransactionReference("")).toBeNull();
    expect(tpayTransactionReference("   ")).toBeNull();
    expect(tpayTransactionReference(12345)).toBeNull();
  });
});
