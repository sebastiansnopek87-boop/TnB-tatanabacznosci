CREATE OR REPLACE FUNCTION public.community_post_stats(_post uuid)
RETURNS TABLE (comments bigint, reactions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM community_comments c WHERE c.post_id = p.id), (SELECT count(*) FROM community_reactions r WHERE r.post_id = p.id)
  FROM community_posts p WHERE p.id = _post AND p.status = 'published' AND p.visibility = 'public'
$$;
GRANT EXECUTE ON FUNCTION public.community_post_stats(uuid) TO anon, authenticated;