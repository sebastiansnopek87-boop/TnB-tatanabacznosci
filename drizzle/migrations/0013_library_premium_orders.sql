ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS price_amount integer CHECK (price_amount IS NULL OR (price_amount >= 100 AND price_amount <= 10000000)),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PLN' CHECK (currency IN ('PLN')),
  ADD COLUMN IF NOT EXISTS payment_product_id text,
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'email_link' CHECK (delivery_method IN ('email_link','email_attachment','account_access')),
  ADD COLUMN IF NOT EXISTS purchasable boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.library_items.price_amount IS 'Price in minor units (grosze).';

GRANT SELECT (price_amount, currency, delivery_method, purchasable) ON public.library_items TO anon, authenticated;

CREATE TABLE public.library_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE RESTRICT,
  user_id uuid,
  buyer_email text NOT NULL CHECK (char_length(buyer_email) BETWEEN 3 AND 254),
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'PLN',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled','refunded','failed')),
  provider text,
  provider_ref text,
  access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  paid_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX library_orders_provider_ref ON public.library_orders(provider, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX library_orders_user_item ON public.library_orders(user_id, item_id) WHERE status = 'paid';
GRANT SELECT ON public.library_orders TO authenticated;
GRANT ALL ON public.library_orders TO service_role;
ALTER TABLE public.library_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own orders" ON public.library_orders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read orders" ON public.library_orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.library_can_read(_item uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM library_items i WHERE i.id = _item AND (
    public.has_role(auth.uid(), 'admin') OR (i.status = 'published' AND (
      i.access = 'public'
      OR (i.access = 'members' AND auth.uid() IS NOT NULL)
      OR (i.access = 'premium' AND auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM library_orders o WHERE o.item_id = i.id AND o.user_id = auth.uid() AND o.status = 'paid'))))))
$$;