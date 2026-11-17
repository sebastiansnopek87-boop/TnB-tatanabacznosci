-- 1. Kolejność (już istnieje; bez zmian, jeśli jest)
ALTER TABLE public.podcast_videos
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 2. Źródło dla materiałów ręcznych/zewnętrznych
ALTER TABLE public.podcast_videos
  ADD COLUMN IF NOT EXISTS external_url text;

-- 3. youtube_id przestaje być obowiązkowe (istniejące wartości zostają)
ALTER TABLE public.podcast_videos ALTER COLUMN youtube_id DROP NOT NULL;

-- 4. Bezpieczne, powtarzalne ograniczenia
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'podcast_videos_external_url_check'
                 AND conrelid = 'public.podcast_videos'::regclass) THEN
    ALTER TABLE public.podcast_videos ADD CONSTRAINT podcast_videos_external_url_check
      CHECK (external_url IS NULL OR external_url ~ '^https://');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'podcast_videos_target_check'
                 AND conrelid = 'public.podcast_videos'::regclass) THEN
    ALTER TABLE public.podcast_videos ADD CONSTRAINT podcast_videos_target_check
      CHECK (youtube_id IS NOT NULL OR external_url IS NOT NULL);
  END IF;
END $$;

-- 5. Raport synchronizacji (już istnieje; bez zmian, jeśli jest)
ALTER TABLE public.youtube_source
  ADD COLUMN IF NOT EXISTS last_sync_skipped integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sync_report jsonb;