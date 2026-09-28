CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

ALTER TABLE public.contact_messages ADD COLUMN read_at timestamptz, ADD COLUMN archived_at timestamptz;
ALTER TABLE public.contact_messages ADD CONSTRAINT contact_messages_status_check CHECK (status IN ('new','read','archived'));

GRANT SELECT, UPDATE ON public.contact_messages TO authenticated;
CREATE POLICY "Admins read messages" ON public.contact_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update messages" ON public.contact_messages FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

GRANT SELECT ON public.newsletter_subscribers TO authenticated;
CREATE POLICY "Admins read subscribers" ON public.newsletter_subscribers FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

GRANT SELECT, UPDATE ON public.email_settings TO authenticated;
CREATE POLICY "Admins read email settings" ON public.email_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update email settings" ON public.email_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

GRANT SELECT ON public.email_notification_log TO authenticated;
CREATE POLICY "Admins read notification log" ON public.email_notification_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.email_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;