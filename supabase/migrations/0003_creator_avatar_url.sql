-- Store the creator's OAuth profile photo (e.g. Google avatar) so the app
-- chrome can show a real picture instead of an initial when one is available.

alter table public.creators add column if not exists avatar_url text;
