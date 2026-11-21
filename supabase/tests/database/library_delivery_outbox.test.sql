-- pgTAP guardrails for the paid-order delivery outbox.
-- These tests are read-only against schema metadata and run after a clean migration replay.
BEGIN;
SELECT plan(12);

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

SELECT * FROM finish();
ROLLBACK;
