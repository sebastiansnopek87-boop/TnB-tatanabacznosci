CREATE TABLE public.podcast_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,120}$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 600),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 20000),
  category text NOT NULL DEFAULT 'ogolne' CHECK (category ~ '^[a-z0-9_]{1,40}$'),
  access text NOT NULL DEFAULT 'public' CHECK (access IN ('public','members','premium')),
  cover_path text,
  audio_path text,
  audio_mime text,
  external_url text CHECK (external_url IS NULL OR external_url ~ '^https://'),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX podcast_episodes_pub_idx ON public.podcast_episodes (status, published_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_episodes TO authenticated;
GRANT ALL ON public.podcast_episodes TO service_role;
ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage podcast" ON public.podcast_episodes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER podcast_episodes_touch BEFORE UPDATE ON public.podcast_episodes FOR EACH ROW EXECUTE FUNCTION public.meetings_touch();