-- RLS audit: every write in the app goes through server actions using the
-- service role. The browser client only ever reads. Drop the one client-side
-- write policy so anon/authenticated keys are read-only across the board.

drop policy if exists "creators update own row" on public.creators;
