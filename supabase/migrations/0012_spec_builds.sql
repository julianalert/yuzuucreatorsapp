-- Spec builds: the admin pre-builds a product from a creator's public Instagram
-- before that creator has ever heard of Yuzuu, then pitches it. The account is
-- real but nobody can sign into it yet — it exists so the pipeline has an owner.
--
-- Two rules hold the whole thing together:
--   1. published stays false, so /u/<handle> 404s for the public. The creator's
--      own approval is still what publishes, exactly as the landing page promises.
--   2. is_spec suppresses every lifecycle email, so a shadow account never mails
--      anyone and an accepting creator inherits no backlog of stale nudges.

-- Set at creation by /admin/spec, cleared at handover once a real person owns it.
alter table public.creators
  add column is_spec boolean not null default false;

-- Unguessable per-draft preview key, so the admin can share an unpublished page
-- with the creator it was built for. Rendering only — it never unlocks checkout,
-- quiz sessions, visit tracking or the OG image, all of which go through
-- publishedProductByHandle(). Rebuilding rotates it, which revokes old links.
alter table public.blueprints
  add column preview_token uuid not null default gen_random_uuid();

-- Partial: spec creators are a small, shrinking set inside a growing table.
create index creators_is_spec_idx on public.creators (is_spec) where is_spec;
