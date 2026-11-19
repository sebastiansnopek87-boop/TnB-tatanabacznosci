-- Private Storage buckets used by Tata Na Baczności.
-- All access is issued through authenticated Edge Functions and short-lived signed URLs.
-- Never make these buckets public: library originals, account avatars and CMS assets
-- can contain non-public files or data that must be checked against publication/access rules.

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
