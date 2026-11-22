-- The prelaunch waitlist is separate from newsletter subscriptions and consent.
CREATE TABLE public.prelaunch_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL CHECK (char_length(btrim(first_name)) BETWEEN 2 AND 100),
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND char_length(email) <= 255),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'notified')),
  consent_text text NOT NULL,
  consent_version text NOT NULL,
  consent_given_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text,
  source text NOT NULL DEFAULT 'prelaunch',
  withdraw_token_hash text UNIQUE CHECK (withdraw_token_hash IS NULL OR withdraw_token_hash ~ '^[a-f0-9]{64}
  withdrawn_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prelaunch_signups_status_created_idx
  ON public.prelaunch_signups (status, created_at DESC);
CREATE INDEX prelaunch_signups_ip_consent_idx
  ON public.prelaunch_signups (ip_hash, consent_given_at DESC)
  WHERE ip_hash IS NOT NULL;

ALTER TABLE public.prelaunch_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.prelaunch_signups FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.prelaunch_signups TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'prelaunch_signups' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'prelaunch_signups must have RLS enabled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'prelaunch_signups'
  ) THEN
    RAISE EXCEPTION 'prelaunch_signups must not expose client RLS policies';
  END IF;
  IF has_table_privilege('anon', 'public.prelaunch_signups', 'SELECT')
     OR has_table_privilege('authenticated', 'public.prelaunch_signups', 'SELECT')
     OR has_table_privilege('anon', 'public.prelaunch_signups', 'INSERT')
     OR has_table_privilege('authenticated', 'public.prelaunch_signups', 'INSERT') THEN
    RAISE EXCEPTION 'Client roles must not access prelaunch_signups directly';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.prelaunch_signups', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.prelaunch_signups', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.prelaunch_signups', 'UPDATE') THEN
    RAISE EXCEPTION 'service_role must manage prelaunch_signups';
  END IF;
END $$;
),
  withdrawn_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prelaunch_signups_status_created_idx
  ON public.prelaunch_signups (status, created_at DESC);
CREATE INDEX prelaunch_signups_ip_created_idx
  ON public.prelaunch_signups (ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

ALTER TABLE public.prelaunch_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.prelaunch_signups FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.prelaunch_signups TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'prelaunch_signups' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'prelaunch_signups must have RLS enabled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'prelaunch_signups'
  ) THEN
    RAISE EXCEPTION 'prelaunch_signups must not expose client RLS policies';
  END IF;
  IF has_table_privilege('anon', 'public.prelaunch_signups', 'SELECT')
     OR has_table_privilege('authenticated', 'public.prelaunch_signups', 'SELECT')
     OR has_table_privilege('anon', 'public.prelaunch_signups', 'INSERT')
     OR has_table_privilege('authenticated', 'public.prelaunch_signups', 'INSERT') THEN
    RAISE EXCEPTION 'Client roles must not access prelaunch_signups directly';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.prelaunch_signups', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.prelaunch_signups', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.prelaunch_signups', 'UPDATE') THEN
    RAISE EXCEPTION 'service_role must manage prelaunch_signups';
  END IF;
END $$;
