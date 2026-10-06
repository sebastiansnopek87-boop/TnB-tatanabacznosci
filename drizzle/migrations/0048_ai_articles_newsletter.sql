ALTER TABLE public.ai_materials ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.article_ai_origin (
  article_id uuid PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.ai_materials(id) ON DELETE SET NULL,
  version_n integer,
  handed_off_at timestamptz NOT NULL DEFAULT now(),
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  cta text NOT NULL DEFAULT '',
  created_by uuid
);
GRANT SELECT ON public.article_ai_origin TO authenticated;
GRANT ALL ON public.article_ai_origin TO service_role;
ALTER TABLE public.article_ai_origin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read ai origin" ON public.article_ai_origin FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TABLE public.article_newsletters (
  article_id uuid PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'none' CHECK (status IN ('none','prepared','pending_approval','approved','sending','sent','failed')),
  subject text NOT NULL DEFAULT '',
  preheader text NOT NULL DEFAULT '',
  intro text NOT NULL DEFAULT '',
  teaser text NOT NULL DEFAULT '',
  outro text NOT NULL DEFAULT '',
  round integer NOT NULL DEFAULT 0,
  mode text CHECK (mode IN ('test','live')),
  recipients integer,
  sent_count integer NOT NULL DEFAULT 0,
  simulated_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  last_note text,
  prepared_by uuid,
  approved_by uuid,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.article_newsletters TO authenticated;
GRANT ALL ON public.article_newsletters TO service_role;
ALTER TABLE public.article_newsletters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read article newsletters" ON public.article_newsletters FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));