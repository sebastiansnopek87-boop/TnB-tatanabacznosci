// Test sends from the panel: same engine and template as real events, sent to
// the address given by the superadmin, with a unique idempotency key. While
// delivery mode is "test" the message is captured ("simulated"), never sent.
import { dispatch } from "./notifications.server";
import type { Vars } from "./notify/render";

export function dispatchTemplateTest(key: string, to: string, vars: Vars) {
  return dispatch({ event: key, to, vars, idempotencyKey: `test-${key}-${crypto.randomUUID()}`, test: true });
}
