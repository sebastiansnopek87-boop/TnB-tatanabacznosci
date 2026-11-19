-- Apply role changes under one PostgreSQL transaction and serialize concurrent
-- changes. This prevents two simultaneous requests from removing the last
-- superadministrator and makes the successful audit entry atomic with the change.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  _actor_id uuid,
  _target_user_id uuid,
  _role public.app_role,
  _grant boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_has_role boolean;
  target_is_superadmin boolean;
  superadmin_count integer;
BEGIN
  LOCK TABLE public.user_roles IN EXCLUSIVE MODE;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _actor_id AND role = 'admin')
     OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _actor_id AND role = 'superadmin') THEN
    RAISE EXCEPTION 'actor_not_superadmin' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'target_user_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _target_user_id AND role = _role)
    INTO current_has_role;

  IF _grant THEN
    IF current_has_role THEN RETURN false; END IF;
    IF _role = 'superadmin' AND NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _target_user_id AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'superadmin_requires_admin' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.user_roles(user_id, role) VALUES (_target_user_id, _role);
    INSERT INTO public.admin_events(type, actor, object_kind, object_id, result, detail)
    VALUES ('role_granted', _actor_id, 'user', _target_user_id::text, 'ok', 'role=' || _role::text);
    RETURN true;
  END IF;

  IF NOT current_has_role THEN RETURN false; END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _target_user_id AND role = 'superadmin')
    INTO target_is_superadmin;

  IF _role = 'admin' AND target_is_superadmin THEN
    RAISE EXCEPTION 'cannot_revoke_admin_from_superadmin' USING ERRCODE = 'P0001';
  END IF;

  IF _role = 'superadmin' THEN
    SELECT count(*) INTO superadmin_count FROM public.user_roles WHERE role = 'superadmin';
    IF superadmin_count <= 1 THEN
      RAISE EXCEPTION 'last_superadmin_protected' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target_user_id AND role = _role;
  INSERT INTO public.admin_events(type, actor, object_kind, object_id, result, detail)
  VALUES ('role_revoked', _actor_id, 'user', _target_user_id::text, 'ok', 'role=' || _role::text);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, uuid, public.app_role, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, uuid, public.app_role, boolean) TO service_role;
