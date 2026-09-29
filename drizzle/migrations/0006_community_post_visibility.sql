ALTER TABLE public.community_posts ADD COLUMN visibility text NOT NULL DEFAULT 'community';
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_visibility_chk CHECK (visibility IN ('public','community'));
CREATE INDEX IF NOT EXISTS community_posts_public_idx ON public.community_posts (created_at DESC) WHERE visibility = 'public' AND status = 'published';
-- Anonymous visitors: only safe columns (no author_id), only public + published posts.
GRANT SELECT (id, author_name, body, status, visibility, created_at, updated_at) ON public.community_posts TO anon;
CREATE POLICY "Public read public posts" ON public.community_posts FOR SELECT TO anon
  USING (status = 'published' AND visibility = 'public');