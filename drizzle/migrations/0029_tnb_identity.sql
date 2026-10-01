CREATE TABLE public.user_identities (
  user_id uuid PRIMARY KEY,
  tnb_id text NOT NULL UNIQUE,
  display_mode text NOT NULL DEFAULT 'nick' CHECK (display_mode IN ('nick','full_name')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.user_identities IS 'Permanent TNB ID per account. Rows are never deleted so an ID is never reassigned.';
GRANT SELECT ON public.user_identities TO authenticated;
GRANT ALL ON public.user_identities TO service_role;
ALTER TABLE public.user_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own identity readable" ON public.user_identities FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.tnb_new_id() RETURNS text LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE a text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; r text; b bytea;
BEGIN
  LOOP
    b := gen_random_bytes(8); r := 'TNB-';
    FOR i IN 0..7 LOOP r := r || substr(a, (get_byte(b,i) % 32) + 1, 1); IF i = 3 THEN r := r || '-'; END IF; END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM user_identities WHERE tnb_id = r);
  END LOOP;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.tnb_identity_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'tnb_id_permanent'; END IF;
  NEW.tnb_id := OLD.tnb_id; NEW.user_id := OLD.user_id; NEW.created_at := OLD.created_at; NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER user_identities_guard BEFORE UPDATE OR DELETE ON public.user_identities FOR EACH ROW EXECUTE FUNCTION public.tnb_identity_guard();

INSERT INTO public.user_identities (user_id, tnb_id, display_mode)
SELECT u.id, public.tnb_new_id(),
  CASE WHEN NULLIF(btrim(coalesce(u.raw_user_meta_data->>'nick','')),'') IS NULL
        AND NULLIF(btrim(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name')),'') IS NOT NULL
       THEN 'full_name' ELSE 'nick' END
FROM auth.users u ORDER BY u.created_at;

-- Display name according to the chosen mode; NULL when the required data is missing.
CREATE OR REPLACE FUNCTION public.tnb_display_name(_uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT left(CASE WHEN coalesce(i.display_mode,'nick') = 'full_name'
    THEN NULLIF(btrim(concat_ws(' ', NULLIF(btrim(u.raw_user_meta_data->>'first_name'),''), NULLIF(btrim(u.raw_user_meta_data->>'last_name'),''))),'')
    ELSE NULLIF(btrim(coalesce(u.raw_user_meta_data->>'nick','')),'') END, 60)
  FROM auth.users u LEFT JOIN public.user_identities i ON i.user_id = u.id WHERE u.id = _uid
$$;
REVOKE EXECUTE ON FUNCTION public.tnb_display_name(uuid) FROM PUBLIC, anon, authenticated;

-- Returns caller's identity, creating the TNB ID on first sign-in.
CREATE OR REPLACE FUNCTION public.ensure_my_identity() RETURNS TABLE(tnb_id text, display_mode text, display_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_identities WHERE user_id = auth.uid()) THEN
    SELECT raw_user_meta_data INTO m FROM auth.users WHERE id = auth.uid();
    INSERT INTO user_identities (user_id, tnb_id, display_mode) VALUES (auth.uid(), tnb_new_id(),
      CASE WHEN NULLIF(btrim(coalesce(m->>'nick','')),'') IS NULL AND NULLIF(btrim(concat_ws(' ', m->>'first_name', m->>'last_name')),'') IS NOT NULL THEN 'full_name' ELSE 'nick' END)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN QUERY SELECT i.tnb_id, i.display_mode, tnb_display_name(auth.uid()) FROM user_identities i WHERE i.user_id = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_my_identity() TO authenticated;

-- Admin helper: create missing identities for given accounts.
CREATE OR REPLACE FUNCTION public.ensure_identities(_ids uuid[]) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO user_identities (user_id, tnb_id) SELECT u.id, tnb_new_id() FROM auth.users u
  WHERE u.id = ANY(_ids) AND NOT EXISTS (SELECT 1 FROM user_identities i WHERE i.user_id = u.id)
  ON CONFLICT (user_id) DO NOTHING
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_identities(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_identities(uuid[]) TO service_role;

-- Set mode and re-sign the caller's own posts/comments (owner unchanged).
CREATE OR REPLACE FUNCTION public.set_my_display_mode(_mode text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _mode NOT IN ('nick','full_name') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
  PERFORM ensure_my_identity();
  UPDATE user_identities SET display_mode = _mode WHERE user_id = auth.uid();
  n := tnb_display_name(auth.uid());
  IF n IS NULL THEN RAISE EXCEPTION 'display_name_missing' USING ERRCODE = 'P0001'; END IF;
  PERFORM set_config('tnb.resign', 'on', true);
  UPDATE community_posts SET author_name = n WHERE author_id = auth.uid() AND author_name IS DISTINCT FROM n;
  UPDATE community_comments SET author_name = n WHERE author_id = auth.uid() AND author_name IS DISTINCT FROM n;
  PERFORM set_config('tnb.resign', 'off', true);
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.set_my_display_mode(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_set_author()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := auth.uid();
    IF NEW.author_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
    n := public.tnb_display_name(NEW.author_id);
    IF n IS NULL THEN RAISE EXCEPTION 'display_name_missing' USING ERRCODE = 'P0001'; END IF;
    NEW.author_name := n;
    NEW.created_at := now();
    IF TG_TABLE_NAME = 'community_posts' THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object('status', 'published'));
    END IF;
  ELSE
    NEW.author_id := OLD.author_id; NEW.created_at := OLD.created_at;
    IF coalesce(current_setting('tnb.resign', true),'') <> 'on' THEN NEW.author_name := OLD.author_name; END IF;
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
END $function$;