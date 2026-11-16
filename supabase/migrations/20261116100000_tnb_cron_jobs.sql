-- Scheduled jobs use a Vault-managed bearer secret. The secret is generated in
-- the database and is never stored in this migration or in the repository.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'TNB_CRON_SECRET'
  ) then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'TNB_CRON_SECRET',
      'Internal bearer token for scheduled TnB Edge Function jobs'
    );
  end if;
end
$$;

create or replace function public.get_tnb_cron_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'TNB_CRON_SECRET'
  limit 1;
$$;

revoke all on function public.get_tnb_cron_secret() from public, anon, authenticated;
grant execute on function public.get_tnb_cron_secret() to service_role;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job
    where jobname in ('tnb-consult-reminders', 'tnb-instagram-sync')
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'tnb-consult-reminders',
    '*/15 * * * *',
    $job$
      select net.http_post(
        url := 'https://pmdfiipontreuclfumdh.supabase.co/functions/v1/tnb-consult',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'TNB_CRON_SECRET' limit 1
          )
        ),
        body := jsonb_build_object('action', 'processReminders'),
        timeout_milliseconds := 30000
      );
    $job$
  );

  perform cron.schedule(
    'tnb-instagram-sync',
    '*/30 * * * *',
    $job$
      select net.http_post(
        url := 'https://pmdfiipontreuclfumdh.supabase.co/functions/v1/tnb-voice',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'TNB_CRON_SECRET' limit 1
          )
        ),
        body := jsonb_build_object('action', 'cronInstagramSync'),
        timeout_milliseconds := 30000
      );
    $job$
  );
end
$$;
