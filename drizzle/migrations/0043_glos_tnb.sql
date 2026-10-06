ALTER TABLE public.platform_settings
  ADD COLUMN social_youtube text CHECK (social_youtube IS NULL OR social_youtube ~ '^https://'),
  ADD COLUMN social_spotify text CHECK (social_spotify IS NULL OR social_spotify ~ '^https://'),
  ADD COLUMN social_tiktok text CHECK (social_tiktok IS NULL OR social_tiktok ~ '^https://'),
  ADD COLUMN social_instagram text CHECK (social_instagram IS NULL OR social_instagram ~ '^https://');

CREATE TABLE public.podcast_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id text NOT NULL CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  published_on date,
  thumbnail_url text CHECK (thumbnail_url IS NULL OR thumbnail_url ~ '^https://'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.podcast_videos IS 'Głos TNB: manually added YouTube links (no sync, no copies of media).';
GRANT SELECT ON public.podcast_videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_videos TO authenticated;
GRANT ALL ON public.podcast_videos TO service_role;
ALTER TABLE public.podcast_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads published videos" ON public.podcast_videos FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "Admins manage videos" ON public.podcast_videos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.voice_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  about text NOT NULL DEFAULT '' CHECK (char_length(about) <= 1000),
  topic text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 1000),
  story text NOT NULL CHECK (char_length(story) BETWEEN 1 AND 5000),
  why text NOT NULL DEFAULT '' CHECK (char_length(why) <= 2000),
  profile_url text CHECK (profile_url IS NULL OR char_length(profile_url) <= 500),
  contact_consent boolean NOT NULL CHECK (contact_consent),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','review','contacted','invited','recorded','rejected','archived')),
  admin_note text NOT NULL DEFAULT '' CHECK (char_length(admin_note) <= 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.voice_submissions IS 'Głos TNB guest story submissions. Insert only via server fn; admin-only reads.';
GRANT SELECT, UPDATE ON public.voice_submissions TO authenticated;
GRANT ALL ON public.voice_submissions TO service_role;
ALTER TABLE public.voice_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read submissions" ON public.voice_submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update submissions" ON public.voice_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));