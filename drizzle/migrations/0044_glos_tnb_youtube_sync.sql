ALTER TABLE public.podcast_videos
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','youtube')),
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS podcast_videos_youtube_id_key ON public.podcast_videos (youtube_id);

CREATE TABLE public.youtube_source (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  channel_input text,
  channel_id text,
  channel_title text,
  channel_thumb text,
  channel_url text,
  uploads_playlist text,
  status text NOT NULL DEFAULT 'unconfigured' CHECK (status IN ('unconfigured','ok','error')),
  last_error text,
  last_sync_at timestamptz,
  last_attempt_at timestamptz,
  last_sync_added integer NOT NULL DEFAULT 0,
  last_sync_updated integer NOT NULL DEFAULT 0,
  video_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
COMMENT ON TABLE public.youtube_source IS 'Głos TNB: single official YouTube channel; metadata synced from its uploads playlist via YouTube Data API (server-side key).';
GRANT SELECT ON public.youtube_source TO authenticated;
GRANT ALL ON public.youtube_source TO service_role;
ALTER TABLE public.youtube_source ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read youtube source" ON public.youtube_source FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.youtube_source (id) VALUES (1) ON CONFLICT DO NOTHING;