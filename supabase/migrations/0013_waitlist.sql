-- Pre-launch waitlist for the home-services platform. Written only by the
-- joinWaitlist server action (service role); RLS on with no policies keeps it
-- unreachable from the browser key.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  trade text,
  source text,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;
