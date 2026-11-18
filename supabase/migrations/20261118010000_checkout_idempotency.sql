-- Checkout idempotency: one durable order per client-generated checkout intent.
-- Existing orders remain valid; the key is nullable for backwards compatibility.
ALTER TABLE public.library_orders
  ADD COLUMN checkout_idempotency_key uuid,
  ADD COLUMN checkout_request_fingerprint text,
  ADD COLUMN checkout_state text NOT NULL DEFAULT 'legacy'
    CHECK (checkout_state IN ('legacy', 'creating', 'ready', 'needs_review')),
  ADD COLUMN checkout_redirect_url text;

ALTER TABLE public.library_orders
  ADD CONSTRAINT library_orders_checkout_key_fingerprint_check
  CHECK (
    (checkout_idempotency_key IS NULL AND checkout_request_fingerprint IS NULL)
    OR
    (checkout_idempotency_key IS NOT NULL AND checkout_request_fingerprint IS NOT NULL
      AND checkout_request_fingerprint ~ '^[0-9a-f]{64})
  );

CREATE UNIQUE INDEX library_orders_checkout_idempotency_uidx
  ON public.library_orders (checkout_idempotency_key)
  WHERE checkout_idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.library_orders.checkout_idempotency_key IS
  'Client-generated UUID for a single checkout intent; null for historical orders.';
COMMENT ON COLUMN public.library_orders.checkout_request_fingerprint IS
  'SHA-256 of canonical checkout inputs; contains no raw personal data.';
COMMENT ON COLUMN public.library_orders.checkout_state IS
  'creating prevents duplicate provider calls; ready permits safe replay; needs_review blocks ambiguous retries.';
COMMENT ON COLUMN public.library_orders.checkout_redirect_url IS
  'Provider checkout URL retained for idempotent replay; service_role only.';
REVOKE ALL PRIVILEGES ON TABLE public.library_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.library_orders TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.library_orders TO service_role;
)
  );

CREATE UNIQUE INDEX library_orders_checkout_idempotency_uidx
  ON public.library_orders (checkout_idempotency_key)
  WHERE checkout_idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.library_orders.checkout_idempotency_key IS
  'Client-generated UUID for a single checkout intent; null for historical orders.';
COMMENT ON COLUMN public.library_orders.checkout_request_fingerprint IS
  'SHA-256 of canonical checkout inputs; contains no raw personal data.';
COMMENT ON COLUMN public.library_orders.checkout_state IS
  'creating prevents duplicate provider calls; ready permits safe replay; needs_review blocks ambiguous retries.';
COMMENT ON COLUMN public.library_orders.checkout_redirect_url IS
  'Provider checkout URL retained for idempotent replay; service_role only.';
REVOKE ALL PRIVILEGES ON TABLE public.library_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.library_orders TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.library_orders TO service_role;
