CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,120}$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  kind text NOT NULL DEFAULT 'online' CHECK (kind IN ('online','live')),
  summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 600),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 20000),
  rules text NOT NULL DEFAULT '' CHECK (char_length(rules) <= 5000),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 300),
  location_public boolean NOT NULL DEFAULT false,
  image_url text,
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  registration_open boolean NOT NULL DEFAULT false,
  requires_login boolean NOT NULL DEFAULT false,
  requires_approval boolean NOT NULL DEFAULT true,
  online_link text CHECK (online_link IS NULL OR online_link ~ '^https://'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by uuid DEFAULT auth.uid(),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage meetings" ON public.meetings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER meetings_touch BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.library_touch();

CREATE TABLE public.meeting_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 120),
  email text NOT NULL CHECK (char_length(email) <= 254),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 20),
  message text CHECK (message IS NULL OR char_length(message) <= 1000),
  consent_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  attended boolean NOT NULL DEFAULT false,
  access_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX meeting_registrations_email_uniq ON public.meeting_registrations (meeting_id, lower(email));
CREATE INDEX meeting_registrations_meeting_idx ON public.meeting_registrations (meeting_id, status);
GRANT SELECT, UPDATE ON public.meeting_registrations TO authenticated;
GRANT ALL ON public.meeting_registrations TO service_role;
ALTER TABLE public.meeting_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read registrations" ON public.meeting_registrations FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update registrations" ON public.meeting_registrations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users read own registrations" ON public.meeting_registrations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER meeting_registrations_touch BEFORE UPDATE ON public.meeting_registrations FOR EACH ROW EXECUTE FUNCTION public.library_touch();

CREATE OR REPLACE FUNCTION public.meeting_capacity_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cap integer; taken integer;
BEGIN
  IF NEW.status NOT IN ('pending','approved') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('pending','approved') THEN RETURN NEW; END IF;
  SELECT capacity INTO cap FROM public.meetings WHERE id = NEW.meeting_id FOR UPDATE;
  IF cap IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO taken FROM public.meeting_registrations WHERE meeting_id = NEW.meeting_id AND status IN ('pending','approved') AND id <> NEW.id;
  IF taken >= cap THEN RAISE EXCEPTION 'meeting_full' USING ERRCODE = 'P0001'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER meeting_capacity BEFORE INSERT OR UPDATE OF status ON public.meeting_registrations FOR EACH ROW EXECUTE FUNCTION public.meeting_capacity_guard();