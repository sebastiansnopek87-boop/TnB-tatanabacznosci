CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','unsubscribed')),
  source text NOT NULL DEFAULT 'homepage',
  consent_text text NOT NULL,
  consent_version text NOT NULL,
  consent_given_at timestamptz NOT NULL DEFAULT now(),
  opt_in_method text NOT NULL DEFAULT 'single' CHECK (opt_in_method IN ('single','double')),
  confirm_token uuid DEFAULT gen_random_uuid(),
  confirmed_at timestamptz,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  unsubscribed_at timestamptz,
  ip_hash text,
  user_agent text,
  subscribe_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX newsletter_subscribers_email_key ON public.newsletter_subscribers (lower(email));
CREATE UNIQUE INDEX newsletter_subscribers_unsub_key ON public.newsletter_subscribers (unsubscribe_token);
CREATE INDEX newsletter_subscribers_status_idx ON public.newsletter_subscribers (status, created_at DESC);
CREATE INDEX newsletter_subscribers_ip_idx ON public.newsletter_subscribers (ip_hash, updated_at DESC);
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  notification_recipient text,
  sender_name text NOT NULL DEFAULT 'Tata Na Baczności',
  sender_local_part text NOT NULL DEFAULT 'powiadomienia',
  sender_domain text,
  admin_inbox_url text,
  contact_notifications_enabled boolean NOT NULL DEFAULT true,
  newsletter_notifications_enabled boolean NOT NULL DEFAULT false,
  newsletter_double_opt_in boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_settings TO service_role;
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.email_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.email_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  related_id uuid,
  recipient text,
  status text NOT NULL CHECK (status IN ('sent','skipped','failed','suppressed')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_notification_log_created_idx ON public.email_notification_log (created_at DESC);
GRANT ALL ON public.email_notification_log TO service_role;
ALTER TABLE public.email_notification_log ENABLE ROW LEVEL SECURITY;