ALTER TABLE public.library_orders DROP CONSTRAINT library_orders_status_check;
ALTER TABLE public.library_orders ADD CONSTRAINT library_orders_status_check CHECK (status = ANY (ARRAY['pending','paid','cancelled','refunded','failed','refund_pending','needs_review']));
ALTER TABLE public.library_orders DROP CONSTRAINT library_orders_payment_method_check;
ALTER TABLE public.library_orders ADD CONSTRAINT library_orders_payment_method_check CHECK (payment_method = ANY (ARRAY['bank_transfer','online_p24','online']));
ALTER TABLE public.library_orders ADD COLUMN IF NOT EXISTS access_revoked_at timestamptz;
ALTER TABLE public.library_orders ADD COLUMN IF NOT EXISTS refund_reason text;
ALTER TABLE public.library_orders ADD COLUMN IF NOT EXISTS review_reason text;
CREATE UNIQUE INDEX IF NOT EXISTS library_orders_provider_ref_uq ON public.library_orders(provider, provider_ref) WHERE provider_ref IS NOT NULL;

CREATE TABLE public.payment_providers (
  id text PRIMARY KEY CHECK (id IN ('p24','tpay','payu')),
  enabled boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  merchant_id text,
  pos_id text,
  client_id text,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_detail text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.payment_providers TO authenticated;
GRANT ALL ON public.payment_providers TO service_role;
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read payment providers" ON public.payment_providers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE UNIQUE INDEX payment_providers_one_default ON public.payment_providers(is_default) WHERE is_default;
INSERT INTO public.payment_providers(id) VALUES ('p24'),('tpay'),('payu');

CREATE OR REPLACE FUNCTION public.library_can_read(_item uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM library_items i WHERE i.id = _item AND (
    public.has_role(auth.uid(), 'admin') OR (i.status = 'published' AND (
      i.access = 'public'
      OR (i.access = 'members' AND auth.uid() IS NOT NULL)
      OR (i.access = 'premium' AND auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM library_orders o WHERE o.item_id = i.id
          AND (o.user_id = auth.uid() OR lower(o.buyer_email) = lower(coalesce(auth.jwt()->>'email','-')))
          AND o.paid_at IS NOT NULL AND o.access_revoked_at IS NULL
          AND o.status IN ('paid','refund_pending','refunded')))))))
$function$;