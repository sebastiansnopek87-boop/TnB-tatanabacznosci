-- Restrict SECURITY DEFINER entry points to the identities that the app actually uses.
-- Public content RPCs remain callable by anon/authenticated; role checks are bound to auth.uid().

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND _user_id = auth.uid()
     AND EXISTS (
       SELECT 1
       FROM public.user_roles
       WHERE user_id = auth.uid()
         AND role = _role
     )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.article_comment_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.article_comment_guard() TO service_role;

REVOKE ALL ON FUNCTION public.community_set_author() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_set_author() TO service_role;

REVOKE ALL ON FUNCTION public.meeting_capacity_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meeting_capacity_guard() TO service_role;

REVOKE ALL ON FUNCTION public.ensure_my_identity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_identity() TO authenticated;

REVOKE ALL ON FUNCTION public.set_my_display_mode(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_display_mode(text) TO authenticated;
