ALTER TABLE public.podcast_episodes
  ADD COLUMN subtitle text NOT NULL DEFAULT '' CHECK (char_length(subtitle) <= 300),
  ADD COLUMN episode_number integer CHECK (episode_number IS NULL OR episode_number > 0),
  ADD COLUMN script text NOT NULL DEFAULT '' CHECK (char_length(script) <= 100000);