-- pgTAP guardrails for the paid-order delivery outbox.
-- These tests are read-only against schema metadata and run after a clean migration replay.
BEGIN;
SELECT plan(18);

SELECT has_table('public', 'library_delivery_outbox', 'delivery outbox table exists');
SELECT has_column('public', 'library_delivery_outbox', 'event_key', 'outbox event key exists');
SELECT has_column('public', 'library_delivery_outbox', 'status', 'outbox status exists');
SELECT has_trigger('public', 'library_orders', 'library_orders_enqueue_paid_delivery', 'paid-order trigger exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.library_delivery_outbox'::regclass),
  'outbox has row-level security enabled'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.library_delivery_outbox', 'SELECT'),
  'anon cannot read the outbox'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.library_delivery_outbox', 'SELECT'),
  'authenticated cannot read the outbox'
);
SELECT ok(
  has_table_privilege('service_role', 'public.library_delivery_outbox', 'SELECT,INSERT,UPDATE,DELETE'),
  'service_role can operate the outbox'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.claim_library_delivery_outbox(text,integer)', 'EXECUTE'),
  'anon cannot claim delivery jobs'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.claim_library_delivery_outbox(text,integer)', 'EXECUTE'),
  'authenticated cannot claim delivery jobs'
);
SELECT ok(
  has_function_privilege('service_role', 'public.claim_library_delivery_outbox(text,integer)', 'EXECUTE'),
  'service_role can claim delivery jobs'
);
SELECT ok(
  has_function_privilege('service_role', 'public.finish_library_delivery_outbox(uuid,text,text,boolean)', 'EXECUTE'),
  'service_role can finish delivery jobs'
);


-- Functional queue checks use fixtures inside this transaction. Nothing is
-- persisted beyond this test run.
INSERT INTO public.library_items (id, slug, title, category, status, access)
VALUES (
  'f1000000-0000-4000-8000-000000000001',
  'pgtap-outbox-fixture',
  'Materiał testowy kolejki',
  'ojcostwo',
  'published',
  'public'
);

INSERT INTO public.library_orders (id, item_id, buyer_email, amount, status)
VALUES (
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'pgtap-outbox@example.invalid',
  100,
  'pending'
);

UPDATE public.library_orders
SET status = 'paid', paid_at = now()
WHERE id = 'f2000000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT count(*)::integer FROM public.library_delivery_outbox
   WHERE order_id = 'f2000000-0000-4000-8000-000000000001'),
  2,
  'paid transition enqueues payment and guest-access events'
);

UPDATE public.library_orders
SET status = 'paid'
WHERE id = 'f2000000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT count(*)::integer FROM public.library_delivery_outbox
   WHERE order_id = 'f2000000-0000-4000-8000-000000000001'),
  2,
  'repeated paid update does not enqueue duplicate events'
);

SET LOCAL ROLE service_role;

SELECT is(
  (SELECT count(*)::integer FROM public.claim_library_delivery_outbox('pgtap-worker', 10)),
  2,
  'worker claims both ready events'
);

SELECT is(
  (SELECT count(*)::integer FROM public.library_delivery_outbox
   WHERE order_id = 'f2000000-0000-4000-8000-000000000001'
     AND status = 'processing' AND attempts = 1
     AND locked_by = 'pgtap-worker'),
  2,
  'claimed events receive a processing lease and increment attempts'
);

UPDATE public.library_delivery_outbox
SET locked_at = now() - interval '6 minutes'
WHERE order_id = 'f2000000-0000-4000-8000-000000000001'
  AND status = 'processing';

SELECT is(
  (SELECT count(*)::integer FROM public.claim_library_delivery_outbox('pgtap-worker-recovery', 10)),
  0,
  'expired leases are not automatically reclaimed for another SMTP attempt'
);

RESET ROLE;

SELECT is(
  (SELECT count(*)::integer FROM public.library_delivery_outbox
   WHERE order_id = 'f2000000-0000-4000-8000-000000000001'
     AND status = 'needs_review'),
  2,
  'expired leases move both events to manual review'
);

SELECT * FROM finish();
ROLLBACK;
