-- Atomic checkout idempotency and provider-call state tracking.
-- A request that reached an operator but did not return a conclusive response is
-- kept in "unknown"; it must never trigger an automatic second create call.
CREATE TABLE public.library_checkout_requests (
  idempotency_key uuid PRIMARY KEY,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  order_id uuid NOT NULL UNIQUE REFERENCES public.library_orders(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'reserved'
    CHECK (state IN ('reserved','submitting','ready','unknown','failed')),
  provider_ref text,
  redirect_url text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (state = 'ready' AND provider_ref IS NOT NULL AND redirect_url IS NOT NULL)
    OR state <> 'ready'
  )
);
CREATE INDEX library_checkout_requests_state_updated_idx
  ON public.library_checkout_requests(state, updated_at);
ALTER TABLE public.library_checkout_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_checkout_requests FROM anon, authenticated;
GRANT ALL ON public.library_checkout_requests TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_library_checkout(
  _idempotency_key uuid,
  _payload_hash text,
  _item_id uuid,
  _user_id uuid,
  _buyer_email text,
  _buyer_name text,
  _buyer_phone text,
  _amount integer,
  _currency text,
  _provider text,
  _environment text,
  _consent_text text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.library_checkout_requests%ROWTYPE;
  created_order public.library_orders%ROWTYPE;
BEGIN
  IF _payload_hash !~ '^[0-9a-f]{64}$' OR _amount < 100 OR _currency <> 'PLN'
     OR _provider NOT IN ('p24','tpay','payu')
     OR _environment NOT IN ('sandbox','live') THEN
    RAISE EXCEPTION 'invalid_checkout_payload' USING ERRCODE = '22023';
  END IF;

  -- Serialize only requests sharing the same idempotency key.
  PERFORM pg_advisory_xact_lock(hashtextextended(_idempotency_key::text, 0));

  SELECT * INTO existing
    FROM public.library_checkout_requests
    WHERE idempotency_key = _idempotency_key
    FOR UPDATE;

  IF FOUND THEN
    IF existing.payload_hash <> _payload_hash THEN
      RETURN jsonb_build_object('state','conflict');
    END IF;
    RETURN (
      SELECT jsonb_build_object(
        'state', existing.state,
        'order_id', o.id,
        'access_token', o.access_token,
        'order_number', o.order_number,
        'redirect_url', existing.redirect_url,
        'provider_ref', existing.provider_ref,
        'is_new', false
      )
      FROM public.library_orders o WHERE o.id = existing.order_id
    );
  END IF;

  INSERT INTO public.library_orders (
    item_id, user_id, buyer_email, buyer_name, buyer_phone,
    amount, currency, status, provider, payment_method,
    environment, consent_text
  ) VALUES (
    _item_id, _user_id, lower(_buyer_email), _buyer_name, nullif(_buyer_phone,''),
    _amount, _currency, 'pending', _provider, 'online',
    _environment, _consent_text
  )
  RETURNING * INTO created_order;

  INSERT INTO public.library_checkout_requests (
    idempotency_key, payload_hash, order_id, state
  ) VALUES (
    _idempotency_key, _payload_hash, created_order.id, 'reserved'
  );

  RETURN jsonb_build_object(
    'state','reserved',
    'order_id',created_order.id,
    'access_token',created_order.access_token,
    'order_number',created_order.order_number,
    'is_new',true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_library_checkout(_idempotency_key uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claimed AS (
    UPDATE public.library_checkout_requests
       SET state = 'submitting', updated_at = now()
     WHERE idempotency_key = _idempotency_key AND state = 'reserved'
     RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM claimed);
$$;

CREATE OR REPLACE FUNCTION public.finish_library_checkout(
  _idempotency_key uuid,
  _state text,
  _provider_ref text DEFAULT NULL,
  _redirect_url text DEFAULT NULL,
  _error text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  checkout public.library_checkout_requests%ROWTYPE;
BEGIN
  IF _state NOT IN ('ready','unknown','failed') THEN
    RAISE EXCEPTION 'invalid_checkout_state' USING ERRCODE = '22023';
  END IF;
  IF _state = 'ready' AND (nullif(_provider_ref,'') IS NULL OR nullif(_redirect_url,'') IS NULL) THEN
    RAISE EXCEPTION 'checkout_response_incomplete' USING ERRCODE = '22023';
  END IF;

  UPDATE public.library_checkout_requests
     SET state = _state,
         provider_ref = CASE WHEN _state = 'ready' THEN _provider_ref ELSE provider_ref END,
         redirect_url = CASE WHEN _state = 'ready' THEN _redirect_url ELSE redirect_url END,
         last_error = left(_error,300),
         updated_at = now()
   WHERE idempotency_key = _idempotency_key AND state = 'submitting'
   RETURNING * INTO checkout;

  IF NOT FOUND THEN RETURN false; END IF;

  IF _state = 'ready' THEN
    UPDATE public.library_orders
       SET provider_ref = _provider_ref,
           checkout_session_id = _provider_ref,
           updated_at = now()
     WHERE id = checkout.order_id AND status = 'pending';
  ELSIF _state = 'failed' THEN
    UPDATE public.library_orders
       SET status = 'failed', failed_at = now(), updated_at = now()
     WHERE id = checkout.order_id AND status = 'pending';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_library_checkout(uuid,text,uuid,uuid,text,text,text,integer,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_library_checkout(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_library_checkout(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_library_checkout(uuid,text,uuid,uuid,text,text,text,integer,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_library_checkout(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_library_checkout(uuid,text,text,text,text) TO service_role;
