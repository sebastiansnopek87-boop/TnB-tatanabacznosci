CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text NOT NULL DEFAULT 'Użytkownik',
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_posts_created_idx ON public.community_posts (created_at DESC);
CREATE TABLE public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text NOT NULL DEFAULT 'Użytkownik',
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_comments_post_idx ON public.community_comments (post_id, created_at);
CREATE TABLE public.community_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  type text NOT NULL DEFAULT 'respect' CHECK (type IN ('respect')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts, public.community_comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_reactions TO authenticated;
GRANT ALL ON public.community_posts, public.community_comments, public.community_reactions TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;

-- Author identity is always set by the database, never by the client.
CREATE OR REPLACE FUNCTION public.community_set_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m jsonb; n text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := auth.uid();
    IF NEW.author_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
    SELECT raw_user_meta_data INTO m FROM auth.users WHERE id = NEW.author_id;
    n := NULLIF(btrim(coalesce(m->>'nick','')), '');
    IF n IS NULL THEN n := NULLIF(btrim(concat_ws(' ', m->>'first_name', m->>'last_name')), ''); END IF;
    IF n IS NULL THEN n := NULLIF(btrim(coalesce(m->>'full_name', m->>'name', '')), ''); END IF;
    NEW.author_name := coalesce(left(n, 60), 'Użytkownik');
    NEW.created_at := now();
    IF TG_TABLE_NAME = 'community_posts' THEN NEW.status := 'published'; END IF;
  ELSE
    NEW.author_id := OLD.author_id; NEW.author_name := OLD.author_name; NEW.created_at := OLD.created_at;
    IF TG_TABLE_NAME = 'community_comments' THEN NEW.post_id := OLD.post_id; END IF;
    IF TG_TABLE_NAME = 'community_posts' AND NEW.status IS DISTINCT FROM OLD.status
       AND NOT public.has_role(auth.uid(), 'admin') THEN NEW.status := OLD.status; END IF;
    IF NEW.body IS DISTINCT FROM OLD.body THEN NEW.updated_at := now(); ELSE NEW.updated_at := OLD.updated_at; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER community_posts_author BEFORE INSERT OR UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.community_set_author();
CREATE TRIGGER community_comments_author BEFORE INSERT OR UPDATE ON public.community_comments FOR EACH ROW EXECUTE FUNCTION public.community_set_author();

CREATE OR REPLACE FUNCTION public.community_post_visible(_post uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = _post
    AND (p.status = 'published' OR p.author_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
$$;

CREATE POLICY "Read visible posts" ON public.community_posts FOR SELECT TO authenticated
  USING (status = 'published' OR author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Create own posts" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Edit own posts" ON public.community_posts FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Admins moderate posts" ON public.community_posts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Delete own posts or admin" ON public.community_posts FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Read comments of visible posts" ON public.community_comments FOR SELECT TO authenticated USING (public.community_post_visible(post_id));
CREATE POLICY "Create own comments" ON public.community_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id AND p.status = 'published'));
CREATE POLICY "Edit own comments" ON public.community_comments FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Delete own comments or admin" ON public.community_comments FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Read reactions of visible posts" ON public.community_reactions FOR SELECT TO authenticated USING (public.community_post_visible(post_id));
CREATE POLICY "Add own reaction" ON public.community_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id AND p.status = 'published'));
CREATE POLICY "Remove own reaction" ON public.community_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());