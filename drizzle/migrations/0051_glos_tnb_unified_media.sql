ALTER TABLE public.podcast_videos
  ADD COLUMN IF NOT EXISTS is_custom_title boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_custom_description boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_thumbnail_url text CHECK (custom_thumbnail_url IS NULL OR custom_thumbnail_url ~ '^https://'),
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.youtube_source
  ADD COLUMN IF NOT EXISTS last_sync_skipped integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sync_report jsonb;