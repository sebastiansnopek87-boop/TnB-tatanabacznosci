ALTER TABLE public.community_posts DROP CONSTRAINT community_posts_sector_chk;
UPDATE public.community_posts SET sector = CASE sector WHEN 'relacje' THEN 'malzenstwo' WHEN 'zdrowie' THEN 'sport_zdrowie' WHEN 'wychowanie' THEN 'ojcostwo' ELSE sector END;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_sector_chk CHECK (sector = ANY (ARRAY['ogolne','malzenstwo','mundur','meskie_rozmowy','ojcostwo','rozwoj','sport_zdrowie','wiara']));

CREATE OR REPLACE FUNCTION public.community_feed_filtered(_sort text, _only_mine boolean, _offset integer, _limit integer, _sector text, _author text)
 RETURNS TABLE(id uuid, author_id uuid, author_name text, body text, status text, visibility text, sector text, created_at timestamptz, updated_at timestamptz, comments bigint, reactions bigint, reacted boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT p.*,
      (SELECT count(*) FROM community_comments c WHERE c.post_id = p.id) AS cc,
      (SELECT count(*) FROM community_reactions r WHERE r.post_id = p.id) AS rc,
      EXISTS (SELECT 1 FROM community_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid()) AS me
    FROM community_posts p
    WHERE CASE
      WHEN auth.uid() IS NULL THEN p.status = 'published' AND p.visibility = 'public'
      WHEN _only_mine THEN p.author_id = auth.uid()
      ELSE p.status = 'published' END
      AND (_sector IS NULL OR p.sector = _sector)
      AND (_author IS NULL OR p.author_name = _author)
  )
  SELECT b.id, CASE WHEN auth.uid() IS NULL THEN NULL ELSE b.author_id END, b.author_name, b.body, b.status, b.visibility, b.sector,
    b.created_at, b.updated_at, b.cc, b.rc, b.me
  FROM base b
  ORDER BY
    CASE WHEN _sort = 'active' THEN b.cc + b.rc END DESC NULLS LAST,
    CASE WHEN _sort = 'oldest' THEN b.created_at END ASC,
    b.created_at DESC, b.id
  OFFSET greatest(_offset, 0) LIMIT least(greatest(_limit, 1), 50)
$$;

CREATE OR REPLACE FUNCTION public.community_sector_counts()
 RETURNS TABLE(sector text, posts bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.sector, count(*) FROM community_posts p
  WHERE p.status = 'published' AND p.visibility = 'public' GROUP BY p.sector
$$;

CREATE OR REPLACE FUNCTION public.community_search(_q text)
 RETURNS TABLE(kind text, id uuid, label text, snippet text, sector text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH q AS (SELECT '%' || replace(replace(replace(left(btrim(_q), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS pat),
  vis AS (
    SELECT p.* FROM community_posts p
    WHERE p.status = 'published' AND (auth.uid() IS NOT NULL OR p.visibility = 'public')
  )
  (SELECT 'post', v.id, v.author_name, left(v.body, 160), v.sector FROM vis v, q
    WHERE char_length(btrim(_q)) >= 2 AND v.body ILIKE q.pat ORDER BY v.created_at DESC LIMIT 8)
  UNION ALL
  (SELECT 'user', NULL::uuid, v.author_name, count(*)::text, NULL FROM vis v, q
    WHERE char_length(btrim(_q)) >= 2 AND v.author_name ILIKE q.pat GROUP BY v.author_name ORDER BY count(*) DESC LIMIT 5)
$$;

REVOKE ALL ON FUNCTION public.community_feed_filtered(text, boolean, integer, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.community_sector_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.community_search(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_feed_filtered(text, boolean, integer, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_sector_counts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_search(text) TO anon, authenticated;