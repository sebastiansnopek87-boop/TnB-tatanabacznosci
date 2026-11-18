-- Checkout idempotency: one durable order per client-generated checkout intent.
-- Existing orders remain valid; the key is nullable for backwards compatibility.
ALTER TABLE public.library_orders
  ADD COLUMN checkout_idempotency_key uuid,
  ADD COLUMN checkout_request_fingerprint text,
  ADD COLUMN checkout_state text NOT NULL DEFAULT 'legacy'
    CHECK (checkout_state IN ('legacy', 'creating', 'ready', 'needs_review'));

ALTER TABLE public.library_orders
  ADD CONSTRAINT library_orders_checkout_key_fingerprint_check
  CHECK (
    (checkout_idempotency_key IS NULL AND checkout_request_fingerprint IS NULL)
    OR
    (checkout_idempotency_key IS NOT NULL
      AND checkout_request_fingerprint IS NOT NULL
      AND checkout_request_fingerprint ~ '^[0-9a-f]{64}$')
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

-- Provider redirect URLs can contain bearer-like checkout credentials.
-- Keep them in a server-only table, never in browser-readable library_orders.
CREATE TABLE public.library_checkout_sessions (
  idempotency_key uuid PRIMARY KEY,
  order_id uuid NOT NULL UNIQUE REFERENCES public.library_orders(id) ON DELETE CASCADE,
  redirect_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.library_checkout_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.library_checkout_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.library_checkout_sessions TO service_role;

COMMENT ON TABLE public.library_checkout_sessions IS
  'Server-only checkout replay data; provider redirect URLs are never exposed through browser-readable order rows.';
