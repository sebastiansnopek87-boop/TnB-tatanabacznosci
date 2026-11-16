import { describe, expect, it } from "vitest";
import { providerReferenceMatches } from "../../supabase/functions/_shared/payment-webhook";

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
