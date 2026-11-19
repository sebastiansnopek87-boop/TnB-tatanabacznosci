-- The RLS policies that use community_post_visible() are authenticated-only.
-- Anonymous visitors already have separate SELECT policies restricted to public posts.
-- Remove the direct boolean-existence oracle for anon callers while preserving
-- the authenticated and service-role policy checks.
REVOKE ALL ON FUNCTION public.community_post_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_post_visible(uuid) TO authenticated, service_role;
