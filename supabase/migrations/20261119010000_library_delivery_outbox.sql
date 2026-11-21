-- Durable, transactionally enqueued order notifications and access delivery.
-- The trigger covers every payment path (provider webhook and admin actions).
CREATE TABLE public.library_delivery_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.library_orders(id) ON DELETE CASCADE,
  event_key text NOT NULL CHECK (event_key IN ('order_paid','order_access_delivered','order_guest_access')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','retry','sent','simulated','skipped','needs_review','dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (order_id, event_key)
);

CREATE INDEX library_delivery_outbox_ready_idx
  ON public.library_delivery_outbox (available_at, created_at)
  WHERE status IN ('pending','retry');
CREATE INDEX library_delivery_outbox_stale_idx
  ON public.library_delivery_outbox (locked_at)
  WHERE status = 'processing';

ALTER TABLE public.library_delivery_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.library_delivery_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.library_delivery_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_paid_order_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL THEN
    INSERT INTO public.library_delivery_outbox (order_id, event_key)
    VALUES
      (NEW.id, 'order_paid'),
      (NEW.id, CASE WHEN NEW.user_id IS NULL THEN 'order_guest_access' ELSE 'order_access_delivered' END)
    ON CONFLICT (order_id, event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_orders_enqueue_paid_delivery ON public.library_orders;
CREATE TRIGGER library_orders_enqueue_paid_delivery
AFTER UPDATE OF status, paid_at ON public.library_orders
FOR EACH ROW
WHEN (NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL)
EXECUTE FUNCTION public.enqueue_paid_order_delivery();

REVOKE ALL ON FUNCTION public.enqueue_paid_order_delivery() FROM PUBLIC, anon, authenticated;

-- Claims are short, exclusive leases. Expired processing rows are deliberately
-- moved to needs_review: SMTP acceptance can be ambiguous after a worker crash.
CREATE OR REPLACE FUNCTION public.claim_library_delivery_outbox(
  p_worker text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(id uuid, order_id uuid, event_key text, attempts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  WITH expired AS (
    UPDATE public.library_delivery_outbox
    SET status = 'needs_review',
        locked_at = NULL,
        locked_by = NULL,
        last_error = COALESCE(last_error, 'worker_lease_expired_delivery_result_unknown'),
        updated_at = now()
    WHERE status = 'processing'
      AND locked_at < now() - interval '5 minutes'
    RETURNING order_id, event_key
  )
  UPDATE public.library_orders o
  SET delivery_status = 'not_sent',
      delivery_error = 'needs_review:worker_lease_expired_delivery_result_unknown'
  FROM expired e
  WHERE e.order_id = o.id
    AND e.event_key IN ('order_access_delivered','order_guest_access');

  RETURN QUERY
  WITH picked AS (
    SELECT o.id
    FROM public.library_delivery_outbox o
    WHERE o.status IN ('pending','retry')
      AND o.available_at <= now()
      AND o.attempts < 8
    ORDER BY o.available_at, o.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  )
  UPDATE public.library_delivery_outbox o
  SET status = 'processing',
      attempts = o.attempts + 1,
      locked_at = now(),
      locked_by = left(COALESCE(p_worker, 'worker'), 100),
      updated_at = now()
  FROM picked
  WHERE o.id = picked.id
  RETURNING o.id, o.order_id, o.event_key, o.attempts;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_library_delivery_outbox(
  p_id uuid,
  p_status text,
  p_error text DEFAULT NULL,
  p_safe_to_retry boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE current_attempts integer;
BEGIN
  IF p_status NOT IN ('sent','simulated','skipped','failed','needs_review') THEN
    RAISE EXCEPTION 'invalid delivery result';
  END IF;

  SELECT attempts INTO current_attempts
  FROM public.library_delivery_outbox
  WHERE id = p_id AND status = 'processing'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'delivery lease not found';
  END IF;

  IF p_status IN ('sent','simulated','skipped') THEN
    UPDATE public.library_delivery_outbox
    SET status = p_status, completed_at = now(), locked_at = NULL,
        locked_by = NULL, last_error = NULL, updated_at = now()
    WHERE id = p_id;
  ELSIF p_status = 'failed' AND p_safe_to_retry AND current_attempts < 8 THEN
    UPDATE public.library_delivery_outbox
    SET status = 'retry',
        available_at = now() + make_interval(secs => LEAST(3600, (30 * power(2, LEAST(current_attempts - 1, 7)))::integer)),
        locked_at = NULL, locked_by = NULL,
        last_error = left(COALESCE(p_error, 'delivery_failed'), 500),
        updated_at = now()
    WHERE id = p_id;
  ELSIF p_status = 'failed' AND p_safe_to_retry THEN
    UPDATE public.library_delivery_outbox
    SET status = 'dead_letter', locked_at = NULL, locked_by = NULL,
        last_error = left(COALESCE(p_error, 'delivery_retry_limit_reached'), 500),
        completed_at = now(), updated_at = now()
    WHERE id = p_id;
  ELSE
    UPDATE public.library_delivery_outbox
    SET status = 'needs_review', locked_at = NULL, locked_by = NULL,
        last_error = left(COALESCE(p_error, 'delivery_result_unknown'), 500),
        updated_at = now()
    WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_library_delivery_outbox(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_library_delivery_outbox(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_library_delivery_outbox(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_library_delivery_outbox(uuid, text, text, boolean) TO service_role;

-- Reuse the existing Vault-managed cron credential and tnb-orders authentication.
DO $$
DECLARE existing_job record;
BEGIN
  FOR existing_job IN SELECT jobid FROM cron.job WHERE jobname = 'tnb-library-delivery-outbox'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'tnb-library-delivery-outbox',
    '* * * * *',
    $job$
      SELECT net.http_post(
        url := 'https://pmdfiipontreuclfumdh.supabase.co/functions/v1/tnb-orders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'TNB_CRON_SECRET' LIMIT 1
          )
        ),
        body := jsonb_build_object('action', 'processDeliveryOutbox'),
        timeout_milliseconds := 110000
      );
    $job$
  );
END
$$;
