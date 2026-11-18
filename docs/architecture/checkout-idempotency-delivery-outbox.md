# Checkout idempotency and delivery reliability

## Scope

This change set is intentionally isolated from the React SPA migration PR. It must not be deployed until the database migration, browser caller, Edge Function, provider adapters, and retry worker are released as one compatible unit.

## Current verified behavior

- `createLibraryOrder` inserts a new `library_orders` row for every request.
- The browser API currently sends only `slug`, buyer details, payment method, and consent. It has no stable checkout-intent identifier.
- The Edge Function calls the payment provider after inserting the order, then stores `provider_ref` and `checkout_session_id`.
- A failed provider call marks the order failed. A retry from the browser can create another order.
- Post-payment notification/delivery is invoked inline by `afterPaid`. Its result is recorded on the order, but there is no durable retry queue for failed delivery.
- Notification dispatch currently records messages as `mode: "test"` / `status: "simulated"`; do not treat that path as live customer delivery.

## Required design

### 1. Stable checkout intent

The React checkout must generate a cryptographically random UUID once when the user begins one checkout attempt and retain it through network retries. A deliberate new checkout attempt gets a new UUID. Do not derive the key from email, item slug, IP address, or browser fingerprint.

The Edge Function validates the UUID and binds it to a canonical request fingerprint containing item ID, payment method, normalized email, and amount/currency snapshot. Reusing a key with a different fingerprint returns a conflict and must never mutate the original order.

### 2. Database uniqueness and concurrency

Add a nullable UUID `checkout_idempotency_key` and request fingerprint to `library_orders`, with a unique partial index on the key. Null preserves compatibility for historic rows and non-checkout administrative workflows.

Claim the key with a single database insert/unique constraint before calling a provider. On conflict, load and return the existing order's safe checkout result; never create a second order. A concurrent request that finds an order still being initialized must return a retryable in-progress response, not start another provider transaction.

### 3. Provider creation recovery

Persist a checkout state machine (for example `initializing`, `provider_created`, `provider_failed`, `needs_reconciliation`) and use conditional updates. Never blindly call a provider create endpoint again after an ambiguous timeout: the provider may have created a transaction even though the response was lost.

For each adapter, document and test its idempotency/reconciliation capability. If an operator does not offer a safe idempotency mechanism, reconcile by its transaction lookup using the stored merchant reference before any retry. Unknown outcomes go to manual review rather than duplicate charging.

### 4. Durable delivery outbox

After payment is confirmed, atomically persist a unique outbox event keyed by order and event type. A worker claims pending/retryable events with row locking and bounded attempts, sends the notification/access delivery, then records outcome and next retry time. A unique constraint prevents duplicate logical deliveries. Delivery must remain separate from payment confirmation so an SMTP outage cannot roll back or obscure a confirmed payment.

### 5. Security and privacy

- Never return service-role credentials, provider secrets, raw webhook bodies, or private delivery payloads to the browser.
- Keep payment verification and role checks server-side.
- Do not weaken RLS or change webhook JWT settings as part of this work.
- Store only the minimum request fingerprint material; do not store raw card/payment credentials.
- Keep provider reference matching, amount/currency/environment validation, and signature checks intact.

## Acceptance tests

1. Same key + same payload, sequential requests: exactly one order and one provider transaction; same safe response.
2. Same key + same payload, concurrent requests: exactly one order and one provider transaction.
3. Same key + different payload: conflict, no mutation, no second transaction.
4. Missing/malformed key: rejected before order insertion.
5. Provider timeout after remote creation: reconciliation path; no duplicate charge.
6. Webhook replay: one paid transition and one logical outbox event.
7. Delivery worker crash before send, during send, and after send-before-ack: bounded retry and deduplication behavior documented and tested.
8. SMTP unavailable: payment remains paid; outbox remains retryable; admin can see delivery state.
9. Historic orders without an idempotency key remain readable and administrable.
10. Build, TypeScript, lint, unit tests, Edge Function tests, migration replay, and SPA route smoke all pass.

## Release sequence

1. Implement and test migration locally against a clean database and a snapshot with existing orders.
2. Implement Edge Function idempotency claim/replay and provider reconciliation.
3. Implement stable browser checkout key lifecycle and conflict/in-progress UI.
4. Implement transactional outbox and retry worker with bounded backoff.
5. Run CI and security review; inspect generated Supabase types and migration replay.
6. Deploy compatible schema first, then Edge Functions, then frontend; verify sandbox end-to-end before enabling live delivery.
7. Keep rollback compatible with existing orders and never auto-retry an ambiguous provider create call.
