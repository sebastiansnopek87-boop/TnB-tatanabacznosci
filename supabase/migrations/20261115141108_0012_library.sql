CREATE TABLE public.library_categories (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9_]{2,40}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.library_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.library_categories TO authenticated;
GRANT ALL ON public.library_categories TO service_role;
ALTER TABLE public.library_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads categories" ON public.library_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.library_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.library_categories (slug, name, sort_order) VALUES
 ('ojcostwo','Ojcostwo',1),('malzenstwo','Małżeństwo i relacje',2),('mundur','Mundur i służba',3),
 ('meskie_rozmowy','Męskie rozmowy',4),('rozwoj','Rozwój',5),('zdrowie','Zdrowie',6),('wiara','Wiara',7),
 ('zycie','Życie i doświadczenia',8);

-- Metadata (listing). Protected content lives in library_item_content.
CREATE TABLE public.library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 120),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
  summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 600),
  category text NOT NULL REFERENCES public.library_categories(slug) ON UPDATE CASCADE,
  kind text NOT NULL DEFAULT 'article' CHECK (kind IN ('article','guide','pdf','video','audio','link')),
  cover_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  access text NOT NULL DEFAULT 'members' CHECK (access IN ('public','members','premium')),
  author_name text NOT NULL DEFAULT 'Redakcja TNB' CHECK (char_length(author_name) BETWEEN 1 AND 80),
  created_by uuid DEFAULT auth.uid(),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX library_items_pub_idx ON public.library_items (status, published_at DESC);
GRANT SELECT (id, slug, title, summary, category, kind, cover_url, status, access, author_name, published_at, updated_at) ON public.library_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT ALL ON public.library_items TO service_role;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads published items" ON public.library_items FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "Users read published items" ON public.library_items FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert items" ON public.library_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update items" ON public.library_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete items" ON public.library_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.library_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN NEW.published_at := now(); END IF;
  IF TG_OP = 'UPDATE' THEN NEW.created_at := OLD.created_at; NEW.created_by := OLD.created_by; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER library_items_touch BEFORE INSERT OR UPDATE ON public.library_items FOR EACH ROW EXECUTE FUNCTION public.library_touch();

-- Access rule used by content RLS and the file download server function.
CREATE OR REPLACE FUNCTION public.library_can_read(_item uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM library_items i WHERE i.id = _item AND (
    public.has_role(auth.uid(), 'admin') OR (i.status = 'published' AND (
      i.access = 'public'
      OR (i.access = 'members' AND auth.uid() IS NOT NULL)
      OR (i.access = 'premium' AND public.has_role(auth.uid(), 'premium'))))))
$$;
GRANT EXECUTE ON FUNCTION public.library_can_read(uuid) TO anon, authenticated;

CREATE TABLE public.library_item_content (
  item_id uuid PRIMARY KEY REFERENCES public.library_items(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 100000),
  file_path text,
  file_name text,
  external_url text CHECK (external_url IS NULL OR external_url ~ '^https://'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.library_item_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_item_content TO authenticated;
GRANT ALL ON public.library_item_content TO service_role;
ALTER TABLE public.library_item_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read content with access" ON public.library_item_content FOR SELECT TO anon, authenticated USING (public.library_can_read(item_id));
CREATE POLICY "Admins insert content" ON public.library_item_content FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update content" ON public.library_item_content FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete content" ON public.library_item_content FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));