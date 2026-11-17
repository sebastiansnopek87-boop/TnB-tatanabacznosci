-- Guest comments with e-mail confirmation (statuses, guest data in a server-only table)
ALTER TABLE public.article_comments ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.article_comments DROP CONSTRAINT IF EXISTS article_comments_status_check;
ALTER TABLE public.article_comments ADD CONSTRAINT article_comments_status_check
  CHECK (status IN ('pending_email','confirmed','visible','hidden','rejected','deleted','expired'));

CREATE TABLE public.article_comment_guests (
  comment_id uuid PRIMARY KEY REFERENCES public.article_comments(id) ON DELETE CASCADE,
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 60),
  last_name text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 80),
  email text NOT NULL CHECK (char_length(email) <= 254),
  token_hash text,
  token_expires_at timestamptz,
  token_used_at timestamptz,
  sends integer NOT NULL DEFAULT 1,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX article_comment_guests_token_idx ON public.article_comment_guests(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX article_comment_guests_ip_idx ON public.article_comment_guests(ip_hash, created_at);
GRANT ALL ON public.article_comment_guests TO service_role;
ALTER TABLE public.article_comment_guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read guest data" ON public.article_comment_guests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
GRANT SELECT ON public.article_comment_guests TO authenticated;

CREATE OR REPLACE FUNCTION public.article_comment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text; svc boolean := coalesce(auth.role(),'') = 'service_role';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF svc AND auth.uid() IS NULL THEN
      -- Guest comment created by the server: never public before e-mail confirmation.
      NEW.author_id := NULL; NEW.status := 'pending_email'; NEW.created_at := now(); NEW.updated_at := now();
      RETURN NEW;
    END IF;
    NEW.author_id := auth.uid();
    IF NEW.author_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.author_id AND email_confirmed_at IS NOT NULL) THEN
      RAISE EXCEPTION 'email_unconfirmed' USING ERRCODE = 'P0001'; END IF;
    n := tnb_display_name(NEW.author_id);
    IF n IS NULL THEN RAISE EXCEPTION 'display_name_missing' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM article_comments WHERE author_id = NEW.author_id AND created_at > now() - interval '20 seconds') THEN
      RAISE EXCEPTION 'comment_too_fast' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM article_comments WHERE author_id = NEW.author_id AND article_id = NEW.article_id AND btrim(body) = btrim(NEW.body)) THEN
      RAISE EXCEPTION 'comment_duplicate' USING ERRCODE = 'P0001'; END IF;
    IF (SELECT count(*) FROM article_comments WHERE author_id = NEW.author_id AND created_at > now() - interval '1 hour') >= 30 THEN
      RAISE EXCEPTION 'comment_too_fast' USING ERRCODE = 'P0001'; END IF;
    NEW.author_name := n; NEW.status := 'visible'; NEW.created_at := now(); NEW.updated_at := now();
  ELSE
    NEW.author_id := OLD.author_id; NEW.article_id := OLD.article_id; NEW.created_at := OLD.created_at;
    IF coalesce(current_setting('tnb.resign', true),'') <> 'on' AND NOT svc THEN NEW.author_name := OLD.author_name; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (svc OR has_role(auth.uid(),'admin')) THEN NEW.status := OLD.status; END IF;
    IF NEW.body IS DISTINCT FROM OLD.body THEN
      IF OLD.author_id IS NULL OR OLD.author_id IS DISTINCT FROM auth.uid() THEN NEW.body := OLD.body; NEW.updated_at := OLD.updated_at;
      ELSE NEW.updated_at := now(); END IF;
    ELSE NEW.updated_at := OLD.updated_at; END IF;
  END IF;
  RETURN NEW;
END $$;