import {
  p24VerificationSucceeded,
  providerReferenceMatches,
  tpayTransactionReference,
} from "./payment-webhook.ts";

Deno.test("provider references must match after safe whitespace normalization", () => {
  if (!providerReferenceMatches("TNB-123", "TNB-123")) throw new Error("Expected identical references to match.");
  if (providerReferenceMatches("TNB-123", "TNB-124")) throw new Error("Different references must not match.");
  if (providerReferenceMatches("", "")) throw new Error("Empty references must not match.");
  if (providerReferenceMatches("   ", "   ")) throw new Error("Whitespace-only references must not match.");
  if (!providerReferenceMatches("TNB-123", " TNB-123 ")) throw new Error("Surrounding whitespace should be normalized.");
  if (providerReferenceMatches(null, "TNB-123")) throw new Error("Null stored reference must not match.");
  if (providerReferenceMatches("TNB-123", 123)) throw new Error("Non-string received reference must not match.");
});

Deno.test("P24 verification succeeds only after an HTTP success and provider status success", () => {
  if (!p24VerificationSucceeded(true, "success")) throw new Error("Expected verified P24 success.");
  if (p24VerificationSucceeded(false, "success")) throw new Error("HTTP failure must not pass verification.");
  if (p24VerificationSucceeded(true, "pending")) throw new Error("Pending P24 status must not pass verification.");
  if (p24VerificationSucceeded(true, "SUCCESS")) throw new Error("Unexpected status casing must not pass verification.");
  if (p24VerificationSucceeded(true, null)) throw new Error("Missing P24 status must not pass verification.");
});

Deno.test("Tpay reference uses only a non-empty transaction title", () => {
  if (tpayTransactionReference("  TNB-123  ") !== "TNB-123") throw new Error("Expected trimmed Tpay title.");
  if (tpayTransactionReference("") !== null) throw new Error("Empty Tpay title must be rejected.");
  if (tpayTransactionReference("   ") !== null) throw new Error("Whitespace Tpay title must be rejected.");
  if (tpayTransactionReference(null) !== null) throw new Error("Missing Tpay title must be rejected.");
  if (tpayTransactionReference(123) !== null) throw new Error("Non-string Tpay title must be rejected.");
});
