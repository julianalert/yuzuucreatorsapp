-- Builds carry no heartbeat, so a run that dies without reaching its failure
-- handler (SDK error inside a step, serverless request killed mid-generation)
-- leaves the row on "running" forever and burns the creator's build quota.
-- updated_at is that heartbeat: every stage transition touches it, and the
-- hourly lifecycle sweep fails anything that has stopped moving.
alter table public.builds
  add column if not exists updated_at timestamptz not null default now();

-- backfill so the sweep doesn't immediately reap rows that predate the column
update public.builds set updated_at = coalesce(completed_at, created_at, now());

create index if not exists builds_stuck_idx
  on public.builds (status, updated_at)
  where status in ('queued', 'running');
