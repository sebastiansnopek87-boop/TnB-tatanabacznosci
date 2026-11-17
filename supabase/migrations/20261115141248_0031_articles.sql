CREATE TABLE public.article_categories (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{1,60}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.article_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.article_categories TO authenticated;
GRANT ALL ON public.article_categories TO service_role;
ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads article categories" ON public.article_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage article categories" ON public.article_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,120}$'),
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  category text REFERENCES public.article_categories(slug) ON UPDATE CASCADE ON DELETE SET NULL,
  cover text,
  cover_alt text NOT NULL DEFAULT '',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  author_name text NOT NULL DEFAULT 'Sebastian Snopek',
  reading_minutes integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at timestamptz,
  featured boolean NOT NULL DEFAULT false,
  home_order integer NOT NULL DEFAULT 0,
  seo_title text NOT NULL DEFAULT '',
  seo_description text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX articles_public_idx ON public.articles (status, published_at DESC);
GRANT SELECT ON public.articles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published articles" ON public.articles FOR SELECT TO anon, authenticated
  USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now());
CREATE POLICY "Admins manage articles" ON public.articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER articles_touch BEFORE INSERT OR UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.library_touch();

CREATE TABLE public.article_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  home_mode text NOT NULL DEFAULT 'latest' CHECK (home_mode IN ('latest','featured')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.article_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.article_settings TO authenticated;
GRANT ALL ON public.article_settings TO service_role;
ALTER TABLE public.article_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads article settings" ON public.article_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage article settings" ON public.article_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));