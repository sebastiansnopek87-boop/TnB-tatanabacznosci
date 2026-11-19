CREATE SEQUENCE IF NOT EXISTS public.library_order_number_seq START 1001;
ALTER TABLE public.library_orders
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS buyer_phone text,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS paid_marked_by uuid,
  ADD COLUMN IF NOT EXISTS delivered_marked_by uuid,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
UPDATE public.library_orders SET order_number = 'TNB-' || to_char(created_at,'YYYY') || '-' || nextval('public.library_order_number_seq') WHERE order_number IS NULL;
ALTER TABLE public.library_orders ALTER COLUMN order_number SET DEFAULT ('TNB-' || to_char(now(),'YYYY') || '-' || nextval('public.library_order_number_seq'));
ALTER TABLE public.library_orders ALTER COLUMN order_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS library_orders_order_number_key ON public.library_orders(order_number);
ALTER TABLE public.library_orders ADD CONSTRAINT library_orders_payment_method_check CHECK (payment_method IN ('bank_transfer','online_p24'));
ALTER TABLE public.library_orders ADD CONSTRAINT library_orders_buyer_phone_check CHECK (buyer_phone IS NULL OR char_length(buyer_phone) <= 20);
GRANT USAGE ON SEQUENCE public.library_order_number_seq TO service_role;
COMMENT ON COLUMN public.library_orders.checkout_session_id IS 'DEPRECATED: Stripe removed; reserved for future Przelewy24 session id';
COMMENT ON TABLE public.payment_webhook_events IS 'Idempotency for future payment operator webhooks (Przelewy24); currently unused';