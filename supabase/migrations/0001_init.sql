-- Yuzuu core schema. Mirrors docs/v1-spec.md data model.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- creators
create table public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  handle text unique,                     -- instagram handle, also the URL slug
  display_name text,
  email text not null,
  stripe_account_id text,
  stripe_onboarded boolean default false,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------------ builds
-- one row per pipeline attempt
create table public.builds (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators not null,
  status text not null default 'queued',  -- queued|running|awaiting_topic|awaiting_approval|declined|failed|complete
  stage text,                             -- current stage id, for the progress UI
  halted_at text,                         -- gate name if it stopped
  scrape_data jsonb,                      -- raw ScrapeCreators payloads
  audience_card jsonb,
  topic_proposals jsonb,
  chosen_topic jsonb,
  critic_results jsonb,                   -- every critic's output, for debugging
  reject_reason text,                     -- creator's reason when samples are rejected
  error text,
  cost_usd numeric default 0,
  created_at timestamptz default now(),
  completed_at timestamptz
);
create index builds_creator_idx on public.builds (creator_id, created_at desc);

-- -------------------------------------------------------------- blueprints
create table public.blueprints (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators not null,
  build_id uuid references public.builds,
  version int not null,
  status text not null default 'draft',   -- draft|complete|approved|archived
  data jsonb not null,                    -- the full blueprint, matching blueprint-schema.md
  approved_at timestamptz,
  approved_by uuid,
  published boolean default false,
  price_cents int default 2700,
  created_at timestamptz default now(),
  unique (creator_id, version)
);
-- exactly one published blueprint per creator
create unique index blueprints_one_published_idx
  on public.blueprints (creator_id) where published;

-- ----------------------------------------------------------------- samples
-- the three plans the creator reviews before approval
create table public.samples (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid references public.blueprints not null,
  archetype text not null,
  archetype_label text,
  sections jsonb not null,                -- { section_id: prose }
  pdf_path text,
  created_at timestamptz default now()
);
create index samples_blueprint_idx on public.samples (blueprint_id);

-- ------------------------------------------------------------------ orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid references public.blueprints not null,
  blueprint_version int not null,         -- frozen: which version they bought
  buyer_email text not null,
  quiz_answers jsonb not null,
  resolved_archetype text,
  resolved_signals jsonb,
  stripe_payment_intent text unique,
  amount_cents int not null,
  status text not null default 'pending_payment', -- pending_payment|paid|generating|delivered|failed
  created_at timestamptz default now()
);
create index orders_blueprint_idx on public.orders (blueprint_id, created_at desc);

-- ----------------------------------------------------------------- outputs
create table public.outputs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders unique not null,
  sections jsonb not null,
  pdf_path text,
  generation_ms int,
  cost_usd numeric,
  created_at timestamptz default now()
);

-- --------------------------------------------------------------------- RLS
-- Creators read their own rows through the browser client. Buyers are
-- anonymous: every buyer-facing read/write goes through server code using the
-- service role, which also keeps blueprint IP (content_bank, knowledge_pack)
-- off the wire. No public policies on purpose.

alter table public.creators enable row level security;
alter table public.builds enable row level security;
alter table public.blueprints enable row level security;
alter table public.samples enable row level security;
alter table public.orders enable row level security;
alter table public.outputs enable row level security;

create policy "creators read own row"
  on public.creators for select
  using (user_id = (select auth.uid()));

create policy "creators update own row"
  on public.creators for update
  using (user_id = (select auth.uid()));

create policy "creators read own builds"
  on public.builds for select
  using (creator_id in (select id from public.creators where user_id = (select auth.uid())));

create policy "creators read own blueprints"
  on public.blueprints for select
  using (creator_id in (select id from public.creators where user_id = (select auth.uid())));

create policy "creators read own samples"
  on public.samples for select
  using (blueprint_id in (
    select b.id from public.blueprints b
    join public.creators c on c.id = b.creator_id
    where c.user_id = (select auth.uid())
  ));

create policy "creators read own orders"
  on public.orders for select
  using (blueprint_id in (
    select b.id from public.blueprints b
    join public.creators c on c.id = b.creator_id
    where c.user_id = (select auth.uid())
  ));

-- outputs: no client policies. Buyers fetch through server routes only.

-- ----------------------------------------------------------------- storage
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', false)
on conflict (id) do nothing;
