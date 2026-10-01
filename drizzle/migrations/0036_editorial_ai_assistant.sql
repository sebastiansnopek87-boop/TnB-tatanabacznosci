CREATE TABLE public.ai_editor_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  guidelines text NOT NULL DEFAULT '',
  community_enabled boolean NOT NULL DEFAULT false,
  community_decision_note text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_editor_settings TO authenticated;
GRANT ALL ON public.ai_editor_settings TO service_role;
ALTER TABLE public.ai_editor_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin manages ai settings" ON public.ai_editor_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
INSERT INTO public.ai_editor_settings (id, guidelines) VALUES (true, E'TNB jest społecznością, a nie korporacyjnym portalem.\nAutor dzieli się doświadczeniem, nie występuje jako wszechwiedzący ekspert.\nTreści mają być autentyczne, ludzkie i pozbawione sztucznego patosu.\nNie przypisuj Sebastianowi doświadczeń, których nie potwierdził.\nNie wymyślaj historii członków społeczności.\nNie ograniczaj tematyki wyłącznie do wojska i ojcostwa.\nUwzględniaj rodzinę, relacje, emocje, odpowiedzialność, duchowość, codzienność i rozwój osobisty.\nNie powielaj bez potrzeby istniejących materiałów.\nNie narzucaj odbiorcom jednej właściwej drogi życiowej.\nZachowuj rozróżnienie między treściami refleksyjnymi, edukacyjnymi i specjalistycznymi.') ON CONFLICT DO NOTHING;

CREATE TABLE public.ai_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('web','note','idea')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 300),
  url text CHECK (url IS NULL OR url ~ '^https?://'),
  author text CHECK (author IS NULL OR char_length(author) <= 200),
  published_on date,
  admin_comment text NOT NULL DEFAULT '' CHECK (char_length(admin_comment) <= 2000),
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 60000),
  fetch_status text NOT NULL DEFAULT 'none' CHECK (fetch_status IN ('none','ok','failed','manual')),
  fetch_error text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_sources_status_idx ON public.ai_sources (status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_sources TO authenticated;
GRANT ALL ON public.ai_sources TO service_role;
ALTER TABLE public.ai_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin manages ai sources" ON public.ai_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE TABLE public.ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  period_from date,
  period_to date,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed')),
  source_count integer NOT NULL DEFAULT 0,
  sources_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  findings jsonb,
  error text
);
CREATE INDEX ai_analyses_created_idx ON public.ai_analyses (created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analyses TO authenticated;
GRANT ALL ON public.ai_analyses TO service_role;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin manages ai analyses" ON public.ai_analyses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE TABLE public.ai_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES public.ai_analyses(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  format text NOT NULL,
  description text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','considering','accepted','rejected','later','in_progress','done')),
  reject_reason text,
  linked_kind text CHECK (linked_kind IS NULL OR linked_kind IN ('article','library','podcast')),
  linked_id uuid,
  outline text,
  expansion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_proposals_status_idx ON public.ai_proposals (status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_proposals TO authenticated;
GRANT ALL ON public.ai_proposals TO service_role;
ALTER TABLE public.ai_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin manages ai proposals" ON public.ai_proposals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE TABLE public.ai_proposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.ai_proposals(id) ON DELETE CASCADE,
  actor uuid DEFAULT auth.uid(),
  action text NOT NULL,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_proposal_events_idx ON public.ai_proposal_events (proposal_id, created_at);
GRANT SELECT, INSERT ON public.ai_proposal_events TO authenticated;
GRANT ALL ON public.ai_proposal_events TO service_role;
ALTER TABLE public.ai_proposal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin reads proposal events" ON public.ai_proposal_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Superadmin writes proposal events" ON public.ai_proposal_events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER ai_sources_touch BEFORE INSERT OR UPDATE ON public.ai_sources FOR EACH ROW EXECUTE FUNCTION public.library_touch();
CREATE TRIGGER ai_proposals_touch BEFORE INSERT OR UPDATE ON public.ai_proposals FOR EACH ROW EXECUTE FUNCTION public.library_touch();