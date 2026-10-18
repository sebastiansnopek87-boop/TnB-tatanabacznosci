-- PROPOZYCJA DO OSOBNEJ ZGODY. Nie została wykonana.
-- Pliki pozostają w istniejącym prywatnym bucketcie media.
BEGIN;

CREATE TABLE public.user_avatars (
  user_id uuid PRIMARY KEY,
  object_path text NOT NULL UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_avatar_owned_path CHECK (
    object_path ~ ('^avatars/' || user_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')
  )
);
GRANT SELECT ON public.user_avatars TO authenticated;
GRANT ALL ON public.user_avatars TO service_role;
ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own avatar reference"
  ON public.user_avatars FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.user_avatars IS
  'Own avatar references only. Writes through authenticated server functions using verified caller identity; private images in media. No browser writes or anonymous table reads.';

COMMIT;