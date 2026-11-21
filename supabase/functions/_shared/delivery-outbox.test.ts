import { assertEquals } from "jsr:@std/assert";
import { getOutboxFinishDecision, isSafeDeliveryRetry } from "./delivery-outbox.ts";

Deno.test("only failures before SMTP hand-off are automatically retryable", () => {
  assertEquals(isSafeDeliveryRetry("template_not_found"), true);
  assertEquals(isSafeDeliveryRetry("missing_variables"), true);
  assertEquals(isSafeDeliveryRetry("log_insert_failed"), true);
  assertEquals(isSafeDeliveryRetry("smtp_delivery_failed"), false);
  assertEquals(isSafeDeliveryRetry("internal_error"), false);
  assertEquals(isSafeDeliveryRetry(undefined), false);
});

Deno.test("terminal delivery outcomes never request a retry", () => {
  assertEquals(getOutboxFinishDecision("sent"), { status: "sent", safeToRetry: false });
  assertEquals(getOutboxFinishDecision("simulated"), { status: "simulated", safeToRetry: false });
  assertEquals(getOutboxFinishDecision("skipped"), { status: "skipped", safeToRetry: false });
});

Deno.test("known pre-SMTP failures are eligible for bounded retry", () => {
  assertEquals(getOutboxFinishDecision("failed", "template_not_found"), { status: "failed", safeToRetry: true });
  assertEquals(getOutboxFinishDecision("failed", "missing_variables"), { status: "failed", safeToRetry: true });
  assertEquals(getOutboxFinishDecision("failed", "log_insert_failed"), { status: "failed", safeToRetry: true });
});

Deno.test("SMTP and ambiguous outcomes require manual review", () => {
  assertEquals(getOutboxFinishDecision("failed", "smtp_delivery_failed"), { status: "needs_review", safeToRetry: false });
  assertEquals(getOutboxFinishDecision("failed", "internal_error"), { status: "needs_review", safeToRetry: false });
  assertEquals(getOutboxFinishDecision("duplicate"), { status: "needs_review", safeToRetry: false });
});
