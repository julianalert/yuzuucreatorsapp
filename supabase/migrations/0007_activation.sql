-- Creator activation loop: first-sale tracking, creator-side funnel events,
-- launch checklist state, share kit storage, and lifecycle email dedupe.

-- Activation = the creator's first paid order. Set once, never cleared.
alter table public.creators
  add column first_sale_at timestamptz,
  -- launch checklist state: { item: iso_timestamp } e.g. { "link": "...", "bio": "..." }
  add column launch_checklist jsonb not null default '{}'::jsonb;

-- Paste-ready promotion copy (bio line, story, caption, reel script),
-- generated at publish time from the product itself.
alter table public.blueprints
  add column share_kit jsonb;

-- ------------------------------------------------------------ creator_events
-- Creator-side funnel events. page_visit rows come from a public beacon on
-- /u/[handle]; link_copied rows come from the dashboard copy button.
create table public.creator_events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators not null,
  blueprint_id uuid references public.blueprints,
  type text not null,                       -- page_visit | link_copied
  meta jsonb,
  created_at timestamptz default now()
);
create index creator_events_creator_idx
  on public.creator_events (creator_id, type, created_at desc);

-- Service-role writes only; dashboard reads go through server code.
alter table public.creator_events enable row level security;

-- ---------------------------------------------------------- lifecycle_emails
-- One row per one-shot lifecycle email actually sent. The unique constraint
-- is the dedupe: insert first, send only if the insert succeeded.
create table public.lifecycle_emails (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators not null,
  type text not null,                       -- youre_live | first_sale | nudge_1h | ...
  ref_id text not null default '',          -- build/blueprint id for per-object emails
  created_at timestamptz default now(),
  unique (creator_id, type, ref_id)
);

alter table public.lifecycle_emails enable row level security;
