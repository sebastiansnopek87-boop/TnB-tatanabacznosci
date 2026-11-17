ALTER TABLE public.community_posts ADD COLUMN sector text NOT NULL DEFAULT 'ogolne';
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_sector_chk CHECK (sector IN ('ogolne','ojcostwo','relacje','wychowanie','rozwoj','zdrowie'));
GRANT SELECT (sector) ON public.community_posts TO anon;

-- Guests may read comments under public, published posts (safe columns only).
GRANT SELECT (id, post_id, author_name, body, created_at, updated_at) ON public.community_comments TO anon;
CREATE POLICY "Public read comments of public posts" ON public.community_comments FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id AND p.status = 'published' AND p.visibility = 'public'));

-- Feed with real counts and sorting; honours the same visibility rules as RLS.
CREATE OR REPLACE FUNCTION public.community_feed(_sort text, _only_mine boolean, _offset int, _limit int)
RETURNS TABLE (id uuid, author_id uuid, author_name text, body text, status text, visibility text, sector text,
  created_at timestamptz, updated_at timestamptz, comments bigint, reactions bigint, reacted boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
GRANT EXECUTE ON FUNCTION public.community_feed(text, boolean, int, int) TO anon, authenticated;

CREATE TABLE public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_reports TO authenticated;
GRANT ALL ON public.community_reports TO service_role;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Report visible posts" ON public.community_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'open' AND public.community_post_visible(post_id));
CREATE POLICY "Admins read reports" ON public.community_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update reports" ON public.community_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete reports" ON public.community_reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));