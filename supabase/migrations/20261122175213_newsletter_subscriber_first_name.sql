ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS first_name text;

COMMENT ON COLUMN public.newsletter_subscribers.first_name IS
  'Optional first name supplied during newsletter or prelaunch signup.';
