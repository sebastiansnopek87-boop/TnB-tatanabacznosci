import { assertEquals } from "jsr:@std/assert";
import { isSafeDeliveryRetry } from "./delivery-outbox.ts";

Deno.test("only failures before SMTP hand-off are automatically retryable", () => {
  assertEquals(isSafeDeliveryRetry("template_not_found"), true);
  assertEquals(isSafeDeliveryRetry("missing_variables"), true);
  assertEquals(isSafeDeliveryRetry("log_insert_failed"), true);
  assertEquals(isSafeDeliveryRetry("smtp_delivery_failed"), false);
  assertEquals(isSafeDeliveryRetry("internal_error"), false);
  assertEquals(isSafeDeliveryRetry(undefined), false);
});
