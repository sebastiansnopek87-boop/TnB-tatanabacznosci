-- Reflection questions on articles
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS reflection_question text NOT NULL DEFAULT '';
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS discussion_question text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.article_is_public(_article uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM articles WHERE id = _article AND status = 'published' AND published_at IS NOT NULL AND published_at <= now())
$$;
GRANT EXECUTE ON FUNCTION public.article_is_public(uuid) TO anon, authenticated;

-- Comments
CREATE TABLE public.article_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text NOT NULL DEFAULT '',
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 2 AND 2000),
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX article_comments_article_idx ON public.article_comments(article_id, created_at);
GRANT SELECT ON public.article_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_comments TO authenticated;
GRANT ALL ON public.article_comments TO service_role;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read visible comments of public articles" ON public.article_comments FOR SELECT TO anon, authenticated
  USING ((status = 'visible' AND public.article_is_public(article_id)) OR author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own comment" ON public.article_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.article_is_public(article_id));
CREATE POLICY "update own or admin" ON public.article_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "delete own or admin" ON public.article_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
-- anon must not read author_id
REVOKE SELECT ON public.article_comments FROM anon;
GRANT SELECT (id, article_id, author_name, body, status, created_at, updated_at) ON public.article_comments TO anon;

CREATE OR REPLACE FUNCTION public.article_comment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := auth.uid();
    IF NEW.author_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
    n := tnb_display_name(NEW.author_id);
    IF n IS NULL THEN RAISE EXCEPTION 'display_name_missing' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM article_comments WHERE author_id = NEW.author_id AND created_at > now() - interval '20 seconds') THEN
      RAISE EXCEPTION 'comment_too_fast' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM article_comments WHERE author_id = NEW.author_id AND article_id = NEW.article_id AND btrim(body) = btrim(NEW.body)) THEN
      RAISE EXCEPTION 'comment_duplicate' USING ERRCODE = 'P0001'; END IF;
    IF (SELECT count(*) FROM article_comments WHERE author_id = NEW.author_id AND created_at > now() - interval '1 hour') >= 30 THEN
      RAISE EXCEPTION 'comment_too_fast' USING ERRCODE = 'P0001'; END IF;
    NEW.author_name := n; NEW.status := 'visible'; NEW.created_at := now(); NEW.updated_at := now();
  ELSE
    NEW.author_id := OLD.author_id; NEW.article_id := OLD.article_id; NEW.created_at := OLD.created_at;
    IF coalesce(current_setting('tnb.resign', true),'') <> 'on' THEN NEW.author_name := OLD.author_name; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT has_role(auth.uid(),'admin') THEN NEW.status := OLD.status; END IF;
    IF NEW.body IS DISTINCT FROM OLD.body THEN
      IF OLD.author_id IS DISTINCT FROM auth.uid() THEN NEW.body := OLD.body; NEW.updated_at := OLD.updated_at;
      ELSE NEW.updated_at := now(); END IF;
    ELSE NEW.updated_at := OLD.updated_at; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER article_comments_guard BEFORE INSERT OR UPDATE ON public.article_comments FOR EACH ROW EXECUTE FUNCTION public.article_comment_guard();

-- Comment reports
CREATE TABLE public.article_comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.article_comments(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, reporter_id)
);
GRANT SELECT, INSERT, UPDATE ON public.article_comment_reports TO authenticated;
GRANT ALL ON public.article_comment_reports TO service_role;
ALTER TABLE public.article_comment_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report as self" ON public.article_comment_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "read own or admin" ON public.article_comment_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin resolves" ON public.article_comment_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Reactions (one per user per article)
CREATE TABLE public.article_reactions (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  type text NOT NULL CHECK (type IN ('moved','thought','agree','different')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_reactions TO authenticated;
GRANT ALL ON public.article_reactions TO service_role;
ALTER TABLE public.article_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reaction read" ON public.article_reactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own reaction insert" ON public.article_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.article_is_public(article_id));
CREATE POLICY "own reaction update" ON public.article_reactions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own reaction delete" ON public.article_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Saved articles (private collection)
CREATE TABLE public.article_saves (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);
GRANT SELECT, INSERT, DELETE ON public.article_saves TO authenticated;
GRANT ALL ON public.article_saves TO service_role;
ALTER TABLE public.article_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saves read" ON public.article_saves FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own saves insert" ON public.article_saves FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.article_is_public(article_id));
CREATE POLICY "own saves delete" ON public.article_saves FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Polls (one per article)
CREATE TABLE public.article_polls (
  article_id uuid PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (char_length(btrim(question)) BETWEEN 3 AND 200),
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 6),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.article_polls TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_polls TO authenticated;
GRANT ALL ON public.article_polls TO service_role;
ALTER TABLE public.article_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read polls of public articles" ON public.article_polls FOR SELECT TO anon, authenticated USING (public.article_is_public(article_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages polls" ON public.article_polls FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.article_poll_votes (
  article_id uuid NOT NULL REFERENCES public.article_polls(article_id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  option_index smallint NOT NULL CHECK (option_index BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.article_poll_votes TO authenticated;
GRANT ALL ON public.article_poll_votes TO service_role;
ALTER TABLE public.article_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.article_poll_open(_article uuid, _opt int) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM article_polls p WHERE p.article_id = _article AND p.active AND _opt < jsonb_array_length(p.options)) AND article_is_public(_article)
$$;
GRANT EXECUTE ON FUNCTION public.article_poll_open(uuid, int) TO authenticated;
CREATE POLICY "own vote read" ON public.article_poll_votes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own vote insert" ON public.article_poll_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.article_poll_open(article_id, option_index));
CREATE POLICY "own vote update" ON public.article_poll_votes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.article_poll_open(article_id, option_index));

-- Aggregates (no identities exposed)
CREATE OR REPLACE FUNCTION public.article_stats(_article uuid) RETURNS TABLE(kind text, key text, n bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'reaction', type, count(*) FROM article_reactions WHERE article_id = _article AND (article_is_public(_article) OR has_role(auth.uid(),'admin')) GROUP BY type
  UNION ALL
  SELECT 'poll', option_index::text, count(*) FROM article_poll_votes WHERE article_id = _article AND (article_is_public(_article) OR has_role(auth.uid(),'admin')) GROUP BY option_index
  UNION ALL
  SELECT 'comments', 'visible', count(*) FROM article_comments WHERE article_id = _article AND status = 'visible' AND (article_is_public(_article) OR has_role(auth.uid(),'admin'))
$$;
GRANT EXECUTE ON FUNCTION public.article_stats(uuid) TO anon, authenticated;

-- Display-mode change also re-signs article comments
CREATE OR REPLACE FUNCTION public.set_my_display_mode(_mode text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _mode NOT IN ('nick','full_name') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
  PERFORM ensure_my_identity();
  UPDATE user_identities SET display_mode = _mode WHERE user_id = auth.uid();
  n := tnb_display_name(auth.uid());
  IF n IS NULL THEN RAISE EXCEPTION 'display_name_missing' USING ERRCODE = 'P0001'; END IF;
  PERFORM set_config('tnb.resign', 'on', true);
  UPDATE community_posts SET author_name = n WHERE author_id = auth.uid() AND author_name IS DISTINCT FROM n;
  UPDATE community_comments SET author_name = n WHERE author_id = auth.uid() AND author_name IS DISTINCT FROM n;
  UPDATE article_comments SET author_name = n WHERE author_id = auth.uid() AND author_name IS DISTINCT FROM n;
  PERFORM set_config('tnb.resign', 'off', true);
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.set_my_display_mode(text) TO authenticated;