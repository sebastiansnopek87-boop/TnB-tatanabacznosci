-- Server-only storage tables: no browser role should have table privileges.
-- Keep all existing data and preserve the service_role backend access.
REVOKE ALL PRIVILEGES ON TABLE
  public.instagram_secret,
  public.youtube_secret,
  public.payment_webhook_events
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.instagram_secret,
  public.youtube_secret,
  public.payment_webhook_events
TO service_role;

-- has_role() already binds the requested user id to auth.uid().
-- Anonymous callers have no valid use for this authenticated authorization RPC.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
