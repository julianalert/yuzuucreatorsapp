-- Bank-transfer-only payout details (manual transfers still — an admin reads
-- these and wires the money, same as payout_recipient_id was for), and a way
-- to dismiss the launch checklist for good once a creator's done with it.
alter table public.creators
  add column payout_iban text,
  add column payout_first_name text,
  add column payout_last_name text,
  add column payout_company text,
  add column payout_address text,
  add column launch_checklist_dismissed_at timestamptz;
