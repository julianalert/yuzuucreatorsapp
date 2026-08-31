-- Payments: Yuzuu is merchant of record on a plain Stripe account (no Connect).
-- Buyers pay Yuzuu ($27 + tax added by Stripe Tax); ledger_entries record what
-- each creator is owed; a monthly manual payout run pays balances >= $50.
-- See docs/payments.md.

-- ------------------------------------------------------------------ orders
-- Full money breakdown frozen at time of sale. Never recompute from
-- percentages later — rates change and history must stay reconstructible.
alter table public.orders
  add column currency text not null default 'usd',
  add column gross_cents int,              -- what the buyer paid, tax included
  add column tax_cents int not null default 0,
  add column net_cents int,                -- gross - tax (= the $27 list price)
  add column creator_cents int,            -- 70% of net
  add column platform_cents int,           -- net - creator share
  add column stripe_fee_cents int,         -- actual fee from the balance txn
  add column stripe_checkout_session_id text,
  add column refunded_at timestamptz;
-- status vocabulary grows: pending_payment|paid|generating|delivered|failed|refunded

update public.orders
set gross_cents    = amount_cents,
    net_cents      = amount_cents,
    creator_cents  = round(amount_cents * 0.70),
    platform_cents = amount_cents - round(amount_cents * 0.70)
where gross_cents is null;

-- ---------------------------------------------------------------- creators
-- Payout details, not Connect. payout_recipient_id is an email or short note,
-- never full bank numbers.
alter table public.creators
  add column payout_provider text,         -- 'paypal' | 'bank' | 'other'
  add column payout_recipient_id text,
  add column payout_status text not null default 'not_set',  -- not_set|pending|ready
  add column agreement_signed_at timestamptz,
  drop column stripe_account_id,
  drop column stripe_onboarded;

-- ----------------------------------------------------------------- payouts
-- One row per creator per payout run. Money moves by hand; this table is the
-- record. draft -> sent (entries stamped) -> paid (transfer done).
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators not null,
  amount_cents int not null,
  currency text not null default 'usd',
  external_ref text,                       -- your manual transfer reference
  method text not null default 'manual',
  status text not null default 'draft',    -- draft|sent|paid|failed
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz default now()
);
create index payouts_creator_idx on public.payouts (creator_id, created_at desc);

-- ---------------------------------------------------------- ledger_entries
-- THE source of truth for what Yuzuu owes each creator. Balance is
-- sum(amount_cents) where payout_id is null — never a Stripe API call.
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators not null,
  order_id uuid references public.orders,
  kind text not null,                      -- sale|refund|payout|adjustment
  amount_cents int not null,               -- signed: + owed to creator, - reduces
  currency text not null default 'usd',
  external_ref text,
  available_at timestamptz,                -- sale becomes payable 14 days after
  payout_id uuid references public.payouts,
  created_at timestamptz default now()
);
create index ledger_creator_idx on public.ledger_entries (creator_id, payout_id);
-- webhook idempotency: one sale entry and one refund entry per order, ever
create unique index ledger_order_kind_idx
  on public.ledger_entries (order_id, kind)
  where order_id is not null;

-- RLS on, no policies: service-role only, same as outputs.
alter table public.payouts enable row level security;
alter table public.ledger_entries enable row level security;
