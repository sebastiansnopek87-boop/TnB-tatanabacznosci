-- Public pre-launch interest list. Personal data is writable only through the
-- server-side Edge Function; browser roles receive no table privileges.
create table if not exists public.launch_waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 255),
  consent_text text not null,
  consent_version text not null,
  consent_given_at timestamptz not null default now(),
  source text not null default 'coming_soon',
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create unique index if not exists launch_waitlist_email_lower_uidx
  on public.launch_waitlist (lower(email));

alter table public.launch_waitlist enable row level security;
revoke all on table public.launch_waitlist from anon, authenticated;
grant all on table public.launch_waitlist to service_role;

comment on table public.launch_waitlist is
  'Pre-launch notification signups. Use only to notify the person once about TNB platform launch.';
