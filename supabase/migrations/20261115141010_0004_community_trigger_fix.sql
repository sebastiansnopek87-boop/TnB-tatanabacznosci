CREATE OR REPLACE FUNCTION public.community_set_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m jsonb; n text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := auth.uid();
    IF NEW.author_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
    SELECT raw_user_meta_data INTO m FROM auth.users WHERE id = NEW.author_id;
    n := NULLIF(btrim(coalesce(m->>'nick','')), '');
    IF n IS NULL THEN n := NULLIF(btrim(concat_ws(' ', m->>'first_name', m->>'last_name')), ''); END IF;
    IF n IS NULL THEN n := NULLIF(btrim(coalesce(m->>'full_name', m->>'name', '')), ''); END IF;
    NEW.author_name := coalesce(left(n, 60), 'Użytkownik');
    NEW.created_at := now();
    IF TG_TABLE_NAME = 'community_posts' THEN
      EXECUTE 'SELECT $1 #= hstore(''status'', ''published'')' INTO NEW USING NEW;
    END IF;
  ELSE
    NEW.author_id := OLD.author_id; NEW.author_name := OLD.author_name; NEW.created_at := OLD.created_at;
    IF TG_TABLE_NAME = 'community_comments' THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object('post_id', to_jsonb(OLD)->>'post_id'));
    ELSIF (to_jsonb(NEW)->>'status') IS DISTINCT FROM (to_jsonb(OLD)->>'status') THEN
      IF NOT public.has_role(auth.uid(), 'admin') THEN
        NEW := jsonb_populate_record(NEW, jsonb_build_object('status', to_jsonb(OLD)->>'status'));
      END IF;
    END IF;
    IF NEW.body IS DISTINCT FROM OLD.body THEN NEW.updated_at := now(); ELSE NEW.updated_at := OLD.updated_at; END IF;
  END IF;
  RETURN NEW;
END $$;