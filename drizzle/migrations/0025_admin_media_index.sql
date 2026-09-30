-- Read-only index of stored files for the admin media panel. Service role only.
CREATE OR REPLACE FUNCTION public.admin_media_objects()
RETURNS TABLE (bucket_id text, name text, created_at timestamptz, size bigint, mimetype text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT o.bucket_id, o.name, o.created_at,
         COALESCE((o.metadata->>'size')::bigint, 0), COALESCE(o.metadata->>'mimetype', '')
  FROM storage.objects o
  WHERE o.bucket_id IN ('library-files','podcast-files','meeting-images','page-images','media')
    AND o.name NOT LIKE '%.emptyFolderPlaceholder'
$$;
REVOKE ALL ON FUNCTION public.admin_media_objects() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_media_objects() TO service_role;