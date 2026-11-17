CREATE TABLE public.ai_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES public.ai_proposals(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  subtitle text NOT NULL DEFAULT '',
  format text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('idea','to_create','generating','draft','editing','review','ready','published','rejected','archived')),
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  duplicates jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_author text NOT NULL DEFAULT 'ai' CHECK (last_author IN ('ai','human')),
  handoff_kind text CHECK (handoff_kind IS NULL OR handoff_kind IN ('article','library','podcast')),
  handoff_id uuid,
  handoff_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_materials_updated_idx ON public.ai_materials (updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_materials TO authenticated;
GRANT ALL ON public.ai_materials TO service_role;
ALTER TABLE public.ai_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin manages ai materials" ON public.ai_materials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE TABLE public.ai_material_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.ai_materials(id) ON DELETE CASCADE,
  n integer NOT NULL,
  author text NOT NULL CHECK (author IN ('ai','human')),
  actor uuid,
  note text NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, n)
);
GRANT SELECT, INSERT ON public.ai_material_versions TO authenticated;
GRANT ALL ON public.ai_material_versions TO service_role;
ALTER TABLE public.ai_material_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin reads ai material versions" ON public.ai_material_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Superadmin adds ai material versions" ON public.ai_material_versions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'superadmin'));