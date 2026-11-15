-- OAuth tokens, YouTube API credentials and payment webhook state are server-only.
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

-- Authenticated callers still use has_role() for RLS. Anonymous callers do not.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
FROM PUBLIC, anon;
