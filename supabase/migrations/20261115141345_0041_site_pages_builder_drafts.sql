ALTER TABLE public.site_pages ADD COLUMN IF NOT EXISTS draft jsonb;
ALTER TABLE public.site_pages ADD COLUMN IF NOT EXISTS draft_updated_at timestamptz;
CREATE TABLE public.site_page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.site_pages(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'draft' CHECK (kind IN ('draft','publish','restore')),
  snapshot jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_page_versions_page_idx ON public.site_page_versions(page_id, created_at DESC);
GRANT SELECT, INSERT ON public.site_page_versions TO authenticated;
GRANT ALL ON public.site_page_versions TO service_role;
ALTER TABLE public.site_page_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read page versions" ON public.site_page_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "Admins add page versions" ON public.site_page_versions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));