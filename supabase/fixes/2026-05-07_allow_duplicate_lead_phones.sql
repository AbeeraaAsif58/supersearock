-- Allow multiple leads with the same phone number.
-- Run this once in Supabase SQL editor for existing databases.

drop index if exists public.leads_phone_unique_idx;

create index if not exists leads_phone_idx
on public.leads (phone)
where phone is not null and phone <> '';
