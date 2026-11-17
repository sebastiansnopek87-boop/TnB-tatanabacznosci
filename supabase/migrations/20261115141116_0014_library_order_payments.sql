ALTER TABLE public.library_orders
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS checkout_session_id text,
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_text text,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS library_orders_session_uidx ON public.library_orders(checkout_session_id) WHERE checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS library_orders_token_uidx ON public.library_orders(access_token);
CREATE INDEX IF NOT EXISTS library_orders_created_idx ON public.library_orders(created_at DESC);

CREATE TABLE public.library_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.library_orders(id) ON DELETE CASCADE,
  type text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX library_order_events_order_idx ON public.library_order_events(order_id, created_at);
GRANT SELECT ON public.library_order_events TO authenticated;
GRANT ALL ON public.library_order_events TO service_role;
ALTER TABLE public.library_order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read order events" ON public.library_order_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.payment_webhook_events (
  event_id text PRIMARY KEY,
  environment text NOT NULL,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;