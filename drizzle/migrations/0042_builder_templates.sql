CREATE TABLE public.builder_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  category text NOT NULL DEFAULT 'Inne' CHECK (char_length(category) BETWEEN 1 AND 60),
  scope text NOT NULL DEFAULT 'section' CHECK (scope IN ('element','section','sections')),
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.builder_templates IS 'Visual Builder saved layouts: copies of PageSection config only, no operational data; insertion copies, never links.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.builder_templates TO authenticated;
GRANT ALL ON public.builder_templates TO service_role;
ALTER TABLE public.builder_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage builder templates" ON public.builder_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));