-- Run AFTER 20260326000000_fix_profiles_rls_recursion.sql
-- Use when you created a user in Supabase Auth but login shows "Profile not found".

-- 1) Find your auth user id and email:
--    Supabase Dashboard → Authentication → Users → copy User UID

-- 2) Replace the placeholders below, then run in SQL Editor:

insert into public.profiles (id, email, role, status, is_primary_admin)
values (
  'PASTE-AUTH-USER-UUID-HERE'::uuid,
  'your-admin@email.com',
  'admin',
  'active',
  true
)
on conflict (id) do update set
  email = excluded.email,
  role = 'admin',
  status = 'active',
  is_primary_admin = true,
  updated_at = now();

-- 3) Verify:
select id, email, role, status, is_primary_admin from public.profiles where role = 'admin';
