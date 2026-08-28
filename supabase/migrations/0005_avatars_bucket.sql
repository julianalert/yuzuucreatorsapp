-- Public bucket for creator profile photos copied from Instagram at scrape
-- time (the scraped CDN URLs are signed and expire within days). Uploads go
-- through the service role only; public read is what makes avatar <img> work.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;
