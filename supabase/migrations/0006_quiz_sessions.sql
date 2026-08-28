-- Funnel tracking: one row per visitor quiz attempt, created on the first
-- answer and updated through checkout and payment. Powers admin analytics now
-- and abandoned-quiz / abandoned-checkout emails later.
create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid references public.blueprints not null,
  creator_id uuid references public.creators not null, -- denormalized for per-creator funnels
  status text not null default 'quiz_started', -- quiz_started|quiz_completed|checkout|paid
  answers jsonb not null default '{}'::jsonb,
  last_question_idx int not null default 0,
  questions_total int not null default 0,
  email text,                                   -- captured by the end-of-quiz email step
  order_id uuid references public.orders,
  abandoned_email_sent_at timestamptz,          -- reserved: future abandoned-funnel emails
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index quiz_sessions_creator_idx on public.quiz_sessions (creator_id, created_at desc);
create index quiz_sessions_status_idx on public.quiz_sessions (status, updated_at);

-- Service-role writes only (via /api/quiz-session); no client policies.
alter table public.quiz_sessions enable row level security;
