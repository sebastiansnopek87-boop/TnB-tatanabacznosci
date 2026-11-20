import { assertEquals } from "jsr:@std/assert";
import { p24VerificationSucceeded, providerReferenceMatches } from "./payment-webhook.ts";

Deno.test("provider reference must exactly match the saved transaction reference", () => {
  assertEquals(providerReferenceMatches("TR-CWM-CS7LW1X", "TR-CWM-CS7LW1X"), true);
  assertEquals(providerReferenceMatches("TR-CWM-CS7LW1X", "01K5BK4HEPB0WBCGT51FMTYSYJ"), false);
  assertEquals(providerReferenceMatches("TR-CWM-CS7LW1X", "TR-CWM-CS7LW1X "), false);
  assertEquals(providerReferenceMatches("", "TR-CWM-CS7LW1X"), false);
  assertEquals(providerReferenceMatches(null, "TR-CWM-CS7LW1X"), false);
  assertEquals(providerReferenceMatches("TR-CWM-CS7LW1X", null), false);
});

Deno.test("P24 payment is accepted only after successful server-side verification", () => {
  assertEquals(p24VerificationSucceeded(true, "success"), true);
  assertEquals(p24VerificationSucceeded(false, "success"), false);
  assertEquals(p24VerificationSucceeded(true, "pending"), false);
  assertEquals(p24VerificationSucceeded(true, null), false);
});
