-- TNB private Storage buckets. Public access is mediated by server endpoints
-- that check publication/access before returning a signed URL or image.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('article-images', 'article-images', false),
  ('library-files', 'library-files', false),
  ('media', 'media', false),
  ('meeting-images', 'meeting-images', false),
  ('page-images', 'page-images', false),
  ('podcast-files', 'podcast-files', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false;
