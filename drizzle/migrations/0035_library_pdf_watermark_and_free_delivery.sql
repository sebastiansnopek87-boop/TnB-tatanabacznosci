-- Free-material delivery modes, PDF watermark processing state and a single delivery register.
ALTER TABLE public.library_items ADD COLUMN free_delivery text NOT NULL DEFAULT 'direct'
  CHECK (free_delivery IN ('direct','form_download','email'));

ALTER TABLE public.library_item_content
  ADD COLUMN original_path text,
  ADD COLUMN watermark_status text NOT NULL DEFAULT 'none' CHECK (watermark_status IN ('none','pending','processing','ready','failed')),
  ADD COLUMN watermark_error text,
  ADD COLUMN watermark_source text CHECK (watermark_source IN ('auto','premarked')),
  ADD COLUMN pdf_generated_at timestamptz,
  ADD COLUMN body_updated_at timestamptz;

CREATE TABLE public.library_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  item_title text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('direct','form_download','email')),
  status text NOT NULL CHECK (status IN ('accepted','pending_send','simulated','sent','download_ready','downloaded','send_failed','expired','cancelled')),
  user_id uuid,
  first_name text CHECK (first_name IS NULL OR char_length(first_name) BETWEEN 1 AND 60),
  last_name text CHECK (last_name IS NULL OR char_length(last_name) BETWEEN 1 AND 80),
  email text CHECK (email IS NULL OR char_length(email) <= 254),
  consent_text text,
  privacy_version text,
  consent_at timestamptz,
  token_hash text,
  token_expires_at timestamptz,
  downloaded_at timestamptz,
  download_count integer NOT NULL DEFAULT 0,
  notification_log_id uuid,
  notification_status text,
  ip_hash text,
  retention_until timestamptz NOT NULL DEFAULT (now() + interval '12 months'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX library_requests_token_idx ON public.library_requests(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX library_requests_item_idx ON public.library_requests(item_id, created_at DESC);
CREATE INDEX library_requests_email_idx ON public.library_requests(lower(email), created_at DESC);
CREATE INDEX library_requests_ip_idx ON public.library_requests(ip_hash, created_at);
GRANT SELECT ON public.library_requests TO authenticated;
GRANT ALL ON public.library_requests TO service_role;
ALTER TABLE public.library_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read library requests" ON public.library_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));