# Checkout idempotency and delivery reliability

## Scope

This change set is intentionally isolated from the React SPA migration PR. The checkout idempotency and transactional delivery-outbox implementation is being developed together on `feat/delivery-outbox-worker`; it must not be deployed until CI, migration replay, and the production configuration checks pass as one compatible unit.

## Current verified behavior

- The checkout branch now generates and sends a stable UUID idempotency key, binds it to a SHA-256 fingerprint, and replays the stored redirect URL for a matching completed request.
- A unique partial index prevents two orders from claiming the same checkout key. A mismatched fingerprint conflicts; an in-progress or ambiguous provider result is not retried automatically.
- The `library_orders` paid-transition trigger inserts `order_paid` and the appropriate access-delivery event into `library_delivery_outbox` in the same database transaction as the paid transition. This covers both the payment webhook and administrator confirmation paths.
- `tnb-orders` is the worker entry point. It claims rows using `FOR UPDATE SKIP LOCKED`, a bounded batch, a five-minute lease, and a maximum of eight attempts.
- A stale lease or ambiguous SMTP result moves to `needs_review`. Automatic retries are limited to failures known to happen before SMTP hand-off; these use exponential backoff and end in `dead_letter` after the attempt limit.
- A unique `(order_id, event_key)` constraint and the existing `email_notification_log.idempotency_key` prevent duplicate logical jobs and normal duplicate sends. If a worker crashes after creating a `sending` log or SMTP acceptance is uncertain, the system deliberately stops for manual review instead of sending again.
- Notification dispatch in test mode still records `mode: "test"` / `status: "simulated"`; this is not a real customer email.

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
4. Missing key: accepted only for legacy clients and replaced server-side with a one-request UUID; because that key is not retained by the client, retries from legacy clients are not idempotent. A malformed supplied key is rejected by request validation before order insertion. New SPA clients must send and retain a stable UUID across retries.
5. Provider timeout after remote creation: reconciliation path; no duplicate charge.
6. Webhook replay: one paid transition and one logical outbox event.
7. Worker crash before send: stale lease is recovered to manual review. Crash during/after SMTP hand-off: the existing `sending` log prevents automatic resend; operator review is required to avoid duplicate mail.
8. SMTP unavailable or SMTP result ambiguous: payment remains paid and the outbox enters `needs_review`; the admin order detail already exposes the delivery error and notification log.
9. Historic orders without an idempotency key remain readable and administrable.
10. Build, TypeScript, lint, unit tests, Edge Function tests, migration replay, and SPA route smoke all pass.

## Release sequence

1. Implement and test migration locally against a clean database and a snapshot with existing orders.
2. Implement Edge Function idempotency claim/replay and provider reconciliation.
3. Implement stable browser checkout key lifecycle and conflict/in-progress UI.
4. Implemented in the delivery branch: transactional outbox, authenticated worker, safe pre-SMTP retries, and manual review for ambiguous SMTP outcomes.
5. Run CI and security review; inspect generated Supabase types and migration replay.
6. Deploy compatible schema first, then Edge Functions, then frontend; verify sandbox end-to-end before enabling live delivery.
7. Keep rollback compatible with existing orders and never auto-retry an ambiguous provider create call.
