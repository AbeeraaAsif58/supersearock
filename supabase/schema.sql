-- Run this SQL in Supabase SQL editor.
-- Single company CRM with one primary admin and agent users.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'app_role'
      and n.nspname = 'public'
  ) then
    create type public.app_role as enum ('admin', 'agent');
  end if;
end
$$;
 
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'lead_status'
      and n.nspname = 'public'
  ) then
    create type public.lead_status as enum ('new', 'assigned', 'follow_up', 'interested', 'call_denied', 'closed', 'lost');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'agent_status'
      and n.nspname = 'public'
  ) then
    create type public.agent_status as enum ('active', 'blocked', 'readonly');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.app_role not null default 'agent',
  status public.agent_status not null default 'active',
  is_primary_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_email text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  action_type text not null,
  action_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  source text not null default 'manual',
  budget numeric(14,2),
  location text,
  area text,
  status public.lead_status not null default 'new',
  assigned_agent_id uuid references public.profiles(id) on delete set null,
  notes text,
  custom_fields jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_assignment_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area_keyword text,
  source_match text,
  property_type text,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  priority int not null default 100,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_assignment_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  previous_agent_id uuid references public.profiles(id) on delete set null,
  new_agent_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  method text not null, -- manual | round_robin | rule
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_follow_up_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  activity_type text not null, -- note | call | message
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_agent_id uuid references public.profiles(id) on delete set null,
  title text not null,
  task_type text not null default 'follow_up', -- call | message | meeting | follow_up
  notes text,
  scheduled_for timestamptz not null,
  due_at timestamptz not null,
  status text not null default 'pending', -- pending | completed | missed
  reminder_enabled boolean not null default true,
  completed_at timestamptz,
  reminder_sent_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_settings (
  id boolean primary key default true check (id = true),
  company_name text not null default 'Real Estate CRM',
  company_email text,
  company_phone text,
  timezone text not null default 'Asia/Karachi',
  address text,
  logo_url text,
  round_robin_enabled boolean not null default true,
  auto_assign_on_lead_create boolean not null default false,
  default_assignment_mode text not null default 'manual', -- manual | round_robin | rules
  daily_reminder_hour smallint not null default 9,
  overdue_alerts_enabled boolean not null default true,
  reminder_email_enabled boolean not null default true,
  reminder_in_app_enabled boolean not null default true,
  reminder_whatsapp_enabled boolean not null default false,
  mandatory_transition_notes boolean not null default true,
  close_lost_requires_activity boolean not null default true,
  sla_follow_up_delay_hours int not null default 24,
  session_timeout_minutes int not null default 120,
  enforce_strong_password boolean not null default true,
  password_rotation_days int not null default 90,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_status_change_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  previous_status public.lead_status not null,
  new_status public.lead_status not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  change_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'info',
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute procedure public.set_updated_at();

drop trigger if exists lead_assignment_rules_set_updated_at on public.lead_assignment_rules;
create trigger lead_assignment_rules_set_updated_at
before update on public.lead_assignment_rules
for each row execute procedure public.set_updated_at();

drop trigger if exists follow_up_tasks_set_updated_at on public.follow_up_tasks;
create trigger follow_up_tasks_set_updated_at
before update on public.follow_up_tasks
for each row execute procedure public.set_updated_at();

drop trigger if exists crm_settings_set_updated_at on public.crm_settings;
create trigger crm_settings_set_updated_at
before update on public.crm_settings
for each row execute procedure public.set_updated_at();

-- Ensure there is at most one primary admin.
create unique index if not exists profiles_single_primary_admin_idx
on public.profiles (is_primary_admin)
where is_primary_admin = true;

create unique index if not exists leads_email_unique_idx
on public.leads (lower(email))
where email is not null and email <> '';

create index if not exists leads_phone_idx
on public.leads (phone)
where phone is not null and phone <> '';

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_source_idx on public.leads (source);
create index if not exists leads_budget_idx on public.leads (budget);
create index if not exists leads_area_idx on public.leads (area);
create index if not exists leads_assigned_agent_idx on public.leads (assigned_agent_id);
create index if not exists lead_assignment_rules_priority_idx on public.lead_assignment_rules (priority);
create index if not exists lead_assignment_rules_agent_idx on public.lead_assignment_rules (agent_id);
create index if not exists lead_assignment_logs_lead_idx on public.lead_assignment_logs (lead_id);
create index if not exists lead_assignment_logs_created_idx on public.lead_assignment_logs (created_at desc);
create index if not exists lead_follow_up_activities_lead_idx on public.lead_follow_up_activities (lead_id);
create index if not exists lead_follow_up_activities_created_idx on public.lead_follow_up_activities (created_at desc);
create index if not exists follow_up_tasks_lead_idx on public.follow_up_tasks (lead_id);
create index if not exists follow_up_tasks_status_idx on public.follow_up_tasks (status);
create index if not exists follow_up_tasks_due_idx on public.follow_up_tasks (due_at);
create index if not exists follow_up_tasks_assigned_agent_idx on public.follow_up_tasks (assigned_agent_id);
create index if not exists crm_settings_updated_at_idx on public.crm_settings (updated_at desc);
create index if not exists lead_status_change_logs_lead_idx on public.lead_status_change_logs (lead_id);
create index if not exists lead_status_change_logs_created_idx on public.lead_status_change_logs (created_at desc);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id, is_read);

alter table public.profiles enable row level security;
alter table public.admin_action_logs enable row level security;
alter table public.leads enable row level security;
alter table public.lead_assignment_rules enable row level security;
alter table public.lead_assignment_logs enable row level security;
alter table public.lead_follow_up_activities enable row level security;
alter table public.follow_up_tasks enable row level security;
alter table public.crm_settings enable row level security;
alter table public.lead_status_change_logs enable row level security;
alter table public.notifications enable row level security;

-- Users can read their own profile.
drop policy if exists "users_can_read_own_profile" on public.profiles;
create policy "users_can_read_own_profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- Primary admin can read all profiles.
drop policy if exists "primary_admin_can_read_all_profiles" on public.profiles;
create policy "primary_admin_can_read_all_profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
);

-- Primary admin can manage all agent profiles.
drop policy if exists "primary_admin_can_manage_agents" on public.profiles;
create policy "primary_admin_can_manage_agents"
on public.profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
);

drop policy if exists "primary_admin_can_read_action_logs" on public.admin_action_logs;
create policy "primary_admin_can_read_action_logs"
on public.admin_action_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
);

drop policy if exists "primary_admin_can_insert_action_logs" on public.admin_action_logs;
create policy "primary_admin_can_insert_action_logs"
on public.admin_action_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
);

drop policy if exists "primary_admin_can_manage_leads" on public.leads;
create policy "primary_admin_can_manage_leads"
on public.leads
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
);

drop policy if exists "primary_admin_can_manage_assignment_rules" on public.lead_assignment_rules;
create policy "primary_admin_can_manage_assignment_rules"
on public.lead_assignment_rules
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
);

drop policy if exists "primary_admin_can_manage_assignment_logs" on public.lead_assignment_logs;
create policy "primary_admin_can_manage_assignment_logs"
on public.lead_assignment_logs
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
);

drop policy if exists "primary_admin_can_manage_follow_up_activities" on public.lead_follow_up_activities;
create policy "primary_admin_can_manage_follow_up_activities"
on public.lead_follow_up_activities
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
);

drop policy if exists "primary_admin_can_manage_follow_up_tasks" on public.follow_up_tasks;
create policy "primary_admin_can_manage_follow_up_tasks"
on public.follow_up_tasks
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
);

drop policy if exists "primary_admin_can_manage_crm_settings" on public.crm_settings;
create policy "primary_admin_can_manage_crm_settings"
on public.crm_settings
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
);

drop policy if exists "primary_admin_can_manage_lead_status_logs" on public.lead_status_change_logs;
create policy "primary_admin_can_manage_lead_status_logs"
on public.lead_status_change_logs
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
);

drop policy if exists "users_can_read_own_notifications" on public.notifications;
create policy "users_can_read_own_notifications"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users_can_update_own_notifications" on public.notifications;
create policy "users_can_update_own_notifications"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "primary_admin_can_manage_notifications" on public.notifications;
create policy "primary_admin_can_manage_notifications"
on public.notifications
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_primary_admin = true
  )
);

create or replace function public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_notification_type text default 'info',
  p_entity_type text default null,
  p_entity_id uuid default null
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.notifications (
    user_id,
    title,
    message,
    notification_type,
    entity_type,
    entity_id
  )
  values (
    p_user_id,
    p_title,
    p_message,
    p_notification_type,
    p_entity_type,
    p_entity_id
  );
end;
$$;

create or replace function public.notify_on_follow_up_task_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.assigned_agent_id is not null then
    perform public.create_notification(
      new.assigned_agent_id,
      'New Follow-up Task',
      concat('Task "', new.title, '" scheduled for ', to_char(new.due_at, 'YYYY-MM-DD HH24:MI')),
      'task',
      'follow_up_task',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists follow_up_task_insert_notify on public.follow_up_tasks;
create trigger follow_up_task_insert_notify
after insert on public.follow_up_tasks
for each row execute procedure public.notify_on_follow_up_task_insert();

create or replace function public.notify_on_assignment_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.create_notification(
    new.new_agent_id,
    'Lead Assigned',
    concat('A lead has been assigned to you. Method: ', new.method),
    'assignment',
    'lead',
    new.lead_id
  );
  return new;
end;
$$;

drop trigger if exists lead_assignment_insert_notify on public.lead_assignment_logs;
create trigger lead_assignment_insert_notify
after insert on public.lead_assignment_logs
for each row execute procedure public.notify_on_assignment_insert();

create or replace function public.notify_on_status_change_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  v_admin_id uuid;
begin
  select p.id
  into v_admin_id
  from public.profiles p
  where p.role = 'admin'
    and p.is_primary_admin = true
  limit 1;

  if v_admin_id is not null then
    perform public.create_notification(
      v_admin_id,
      'Lead Status Updated',
      concat('Lead status changed from ', new.previous_status::text, ' to ', new.new_status::text),
      'status',
      'lead',
      new.lead_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists lead_status_change_insert_notify on public.lead_status_change_logs;
create trigger lead_status_change_insert_notify
after insert on public.lead_status_change_logs
for each row execute procedure public.notify_on_status_change_insert();
