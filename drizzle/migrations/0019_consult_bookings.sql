CREATE TABLE public.consult_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consult_availability TO authenticated;
GRANT ALL ON public.consult_availability TO service_role;
ALTER TABLE public.consult_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage availability" ON public.consult_availability FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.consult_blocked_dates (
  day date PRIMARY KEY,
  reason text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consult_blocked_dates TO authenticated;
GRANT ALL ON public.consult_blocked_dates TO service_role;
ALTER TABLE public.consult_blocked_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage blocked dates" ON public.consult_blocked_dates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.consult_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_meeting_link text CHECK (default_meeting_link IS NULL OR default_meeting_link ~ '^https://'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.consult_settings (id) VALUES (1);
GRANT SELECT, UPDATE ON public.consult_settings TO authenticated;
GRANT ALL ON public.consult_settings TO service_role;
ALTER TABLE public.consult_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage consult settings" ON public.consult_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE SEQUENCE public.consult_booking_number_seq START 1001;
GRANT USAGE ON SEQUENCE public.consult_booking_number_seq TO service_role;

CREATE TABLE public.consult_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number text NOT NULL UNIQUE DEFAULT ('TNB-R-' || nextval('public.consult_booking_number_seq')::text),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  user_id uuid,
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 60),
  last_name text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 80),
  email text NOT NULL CHECK (char_length(email) <= 254),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 20),
  topic text NOT NULL CHECK (char_length(topic) BETWEEN 3 AND 150),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 2000),
  question text NOT NULL CHECK (char_length(question) BETWEEN 3 AND 2000),
  consent_text text NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','cancelled_user','cancelled_admin','completed','no_show')),
  meeting_link text CHECK (meeting_link IS NULL OR meeting_link ~ '^https://'),
  access_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  confirmation_status text NOT NULL DEFAULT 'pending' CHECK (confirmation_status IN ('pending','sent','skipped','failed')),
  confirmation_error text,
  reminder_status text NOT NULL DEFAULT 'pending' CHECK (reminder_status IN ('pending','sent','skipped','failed','not_needed')),
  reminder_error text,
  reminder_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 500),
  cancelled_by uuid,
  status_changed_by uuid,
  status_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CONSTRAINT consult_no_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&) WHERE (status = 'booked')
);
CREATE INDEX consult_bookings_starts_idx ON public.consult_bookings (starts_at);
CREATE INDEX consult_bookings_user_idx ON public.consult_bookings (user_id);
GRANT SELECT ON public.consult_bookings TO authenticated;
GRANT ALL ON public.consult_bookings TO service_role;
ALTER TABLE public.consult_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read bookings" ON public.consult_bookings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users read own bookings" ON public.consult_bookings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER consult_bookings_touch BEFORE UPDATE ON public.consult_bookings FOR EACH ROW EXECUTE FUNCTION public.meetings_touch();

CREATE TABLE public.consult_booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.consult_bookings(id) ON DELETE CASCADE,
  type text NOT NULL,
  detail text,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consult_booking_events_idx ON public.consult_booking_events (booking_id, created_at);
GRANT SELECT ON public.consult_booking_events TO authenticated;
GRANT ALL ON public.consult_booking_events TO service_role;
ALTER TABLE public.consult_booking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read booking events" ON public.consult_booking_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));