CREATE TABLE public.admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL,
  actor uuid,
  object_kind text,
  object_id text,
  result text NOT NULL DEFAULT 'ok',
  detail text
);
CREATE INDEX admin_events_created_idx ON public.admin_events (created_at DESC);
GRANT SELECT ON public.admin_events TO authenticated;
GRANT ALL ON public.admin_events TO service_role;
ALTER TABLE public.admin_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read events" ON public.admin_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));