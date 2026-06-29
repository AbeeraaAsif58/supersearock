-- Safe patch for existing projects missing reminder columns on follow_up_tasks.
-- Run in Supabase SQL Editor on the target project DB.

alter table public.follow_up_tasks
  add column if not exists reminder_enabled boolean not null default true;

alter table public.follow_up_tasks
  add column if not exists reminder_sent_at timestamptz;

-- Backfill any nulls just in case column existed without NOT NULL/default.
update public.follow_up_tasks
set reminder_enabled = true
where reminder_enabled is null;

-- Optional helpful index for reminder scans.
create index if not exists follow_up_tasks_reminder_scan_idx
  on public.follow_up_tasks (status, due_at, reminder_enabled, reminder_sent_at);
