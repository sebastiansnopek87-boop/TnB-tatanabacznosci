REVOKE ALL ON public.community_posts FROM anon;
REVOKE ALL ON public.community_comments FROM anon;
REVOKE ALL ON public.community_reactions FROM anon;
GRANT SELECT (id, author_name, body, status, visibility, created_at, updated_at) ON public.community_posts TO anon;