CREATE OR REPLACE FUNCTION public.ai_editor_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN NEW.created_at := OLD.created_at; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ai_sources_touch ON public.ai_sources;
DROP TRIGGER IF EXISTS ai_proposals_touch ON public.ai_proposals;
CREATE TRIGGER ai_sources_touch BEFORE INSERT OR UPDATE ON public.ai_sources FOR EACH ROW EXECUTE FUNCTION public.ai_editor_touch();
CREATE TRIGGER ai_proposals_touch BEFORE INSERT OR UPDATE ON public.ai_proposals FOR EACH ROW EXECUTE FUNCTION public.ai_editor_touch();