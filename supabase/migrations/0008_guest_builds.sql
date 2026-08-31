-- Guest builds: the scan → ideas phase can now run before signup. An anonymous
-- visitor's build has no creator yet — it is owned by an httpOnly cookie token
-- and claimed (creator_id set) when the visitor signs up at the idea-pick step.

alter table public.builds
  alter column creator_id drop not null,
  -- cookie-held ownership token for pre-signup builds; nulled at claim time
  add column guest_token uuid,
  -- the Instagram handle the guest entered (creators.handle is set at claim)
  add column handle text,
  -- the idea picked right before the signup redirect, resumed at claim time
  add column pending_topic_index int;

create index builds_guest_token_idx
  on public.builds (guest_token, created_at desc)
  where guest_token is not null;
