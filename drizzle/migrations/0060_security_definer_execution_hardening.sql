-- Internal SECURITY DEFINER helpers must not be callable from the Data API.
-- Triggers continue to execute these functions as their owner; service-role
-- operations retain EXECUTE where they need it.
REVOKE EXECUTE ON FUNCTION public.admin_media_objects() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_media_objects() TO service_role;

REVOKE EXECUTE ON FUNCTION public.article_comment_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.article_comment_guard() TO service_role;

REVOKE EXECUTE ON FUNCTION public.community_set_author() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_set_author() TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_identities(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_identities(uuid[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.meeting_capacity_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meeting_capacity_guard() TO service_role;

REVOKE EXECUTE ON FUNCTION public.tnb_display_name(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tnb_display_name(uuid) TO service_role;
