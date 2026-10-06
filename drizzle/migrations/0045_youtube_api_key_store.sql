CREATE TABLE public.youtube_secret (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  api_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
COMMENT ON TABLE public.youtube_secret IS 'Głos TNB: YouTube API key set from admin panel; server-only (service_role), never returned to the browser.';
GRANT ALL ON public.youtube_secret TO service_role;
ALTER TABLE public.youtube_secret ENABLE ROW LEVEL SECURITY;