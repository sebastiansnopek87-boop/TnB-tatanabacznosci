-- Explicitly remove PostgreSQL's implicit PUBLIC EXECUTE grants from exposed
-- SECURITY DEFINER RPCs. Preserve the app's intentional anon/authenticated access.
-- article_poll_open is for signed-in poll voting only.

REVOKE ALL ON FUNCTION public.article_is_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.article_is_public(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.article_poll_open(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.article_poll_open(uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.article_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.article_stats(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.community_feed(text, boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_feed(text, boolean, integer, integer) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.community_feed_filtered(text, boolean, integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_feed_filtered(text, boolean, integer, integer, text, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.community_post_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_post_stats(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.community_search(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_search(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.community_sector_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_sector_counts() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.library_can_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.library_can_read(uuid) TO anon, authenticated, service_role;

DO $$
DECLARE
  public_rpc regprocedure;
BEGIN
  FOREACH public_rpc IN ARRAY ARRAY[
    'public.article_is_public(uuid)'::regprocedure,
    'public.article_stats(uuid)'::regprocedure,
    'public.community_feed(text,boolean,integer,integer)'::regprocedure,
    'public.community_feed_filtered(text,boolean,integer,integer,text,text)'::regprocedure,
    'public.community_post_stats(uuid)'::regprocedure,
    'public.community_search(text)'::regprocedure,
    'public.community_sector_counts()'::regprocedure,
    'public.library_can_read(uuid)'::regprocedure,
    'public.article_poll_open(uuid,integer)'::regprocedure
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      WHERE p.oid = public_rpc
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'Unexpected PUBLIC EXECUTE grant remains on %', public_rpc;
    END IF;
  END LOOP;

  IF has_function_privilege('anon', 'public.article_poll_open(uuid,integer)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute article_poll_open';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.article_poll_open(uuid,integer)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute article_poll_open';
  END IF;

  IF NOT has_function_privilege('anon', 'public.community_feed_filtered(text,boolean,integer,integer,text,text)'::regprocedure, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.community_feed_filtered(text,boolean,integer,integer,text,text)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'community_feed_filtered anon/authenticated access changed unexpectedly';
  END IF;

  IF NOT has_function_privilege('anon', 'public.library_can_read(uuid)'::regprocedure, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.library_can_read(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'library_can_read anon/authenticated access changed unexpectedly';
  END IF;
END $$;
