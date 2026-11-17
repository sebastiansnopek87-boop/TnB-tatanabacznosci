CREATE OR REPLACE FUNCTION public.meetings_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS meeting_registrations_touch ON public.meeting_registrations;
CREATE TRIGGER meeting_registrations_touch BEFORE UPDATE ON public.meeting_registrations FOR EACH ROW EXECUTE FUNCTION public.meetings_touch();
DROP TRIGGER IF EXISTS meetings_touch ON public.meetings;
CREATE TRIGGER meetings_touch BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.meetings_touch();