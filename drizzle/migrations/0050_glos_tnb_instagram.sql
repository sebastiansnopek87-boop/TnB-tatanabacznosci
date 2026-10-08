CREATE TABLE public.instagram_source (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','ok','error')),
  ig_user_id text, username text, profile_url text,
  show_reels boolean NOT NULL DEFAULT true, show_posts boolean NOT NULL DEFAULT false, show_carousels boolean NOT NULL DEFAULT false,
  display_count int NOT NULL DEFAULT 6 CHECK (display_count BETWEEN 1 AND 12),
  last_sync_at timestamptz, last_sync_added int NOT NULL DEFAULT 0, last_error text, media_count int NOT NULL DEFAULT 0,
  connected_at timestamptz, connected_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.instagram_source TO authenticated;
GRANT ALL ON public.instagram_source TO service_role;
ALTER TABLE public.instagram_source ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read instagram source" ON public.instagram_source FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.instagram_source (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Token + OAuth state: service role only (no grants to anon/authenticated).
CREATE TABLE public.instagram_secret (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token text, token_expires_at timestamptz,
  oauth_state text, oauth_state_expires_at timestamptz, oauth_redirect text, oauth_actor uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.instagram_secret TO service_role;
ALTER TABLE public.instagram_secret ENABLE ROW LEVEL SECURITY;
INSERT INTO public.instagram_secret (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.instagram_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_id text NOT NULL UNIQUE,
  media_type text NOT NULL, product_type text,
  thumbnail_url text, permalink text NOT NULL, caption text,
  posted_at timestamptz NOT NULL, synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX instagram_media_posted ON public.instagram_media (posted_at DESC);
GRANT SELECT ON public.instagram_media TO anon, authenticated;
GRANT ALL ON public.instagram_media TO service_role;
ALTER TABLE public.instagram_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads instagram media" ON public.instagram_media FOR SELECT TO anon, authenticated USING (true);
COMMENT ON TABLE public.instagram_media IS 'Głos TNB: newest media of the one admin-connected Instagram account (Instagram API with Instagram Login), synced server-side; never entered manually.';