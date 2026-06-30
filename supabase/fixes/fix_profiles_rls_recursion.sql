-- Run in Supabase Dashboard → SQL Editor
-- Fixes login error: "infinite recursion detected in policy for relation profiles"
-- (Profile exists in DB but SELECT fails under RLS, showing "Profile not found")

create or replace function public.is_primary_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_primary_admin = true
      and status <> 'blocked'
  );
$$;

create or replace function public.is_agent()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'agent'
  );
$$;

revoke all on function public.is_primary_admin() from public;
grant execute on function public.is_primary_admin() to authenticated;

revoke all on function public.is_agent() from public;
grant execute on function public.is_agent() to authenticated;

-- profiles
drop policy if exists "primary_admin_can_read_all_profiles" on public.profiles;
create policy "primary_admin_can_read_all_profiles"
on public.profiles for select to authenticated
using (public.is_primary_admin());

drop policy if exists "primary_admin_can_manage_agents" on public.profiles;
create policy "primary_admin_can_manage_agents"
on public.profiles for all to authenticated
using (public.is_primary_admin())
with check (public.is_primary_admin());

-- admin_action_logs
drop policy if exists "primary_admin_can_read_action_logs" on public.admin_action_logs;
create policy "primary_admin_can_read_action_logs"
on public.admin_action_logs for select to authenticated
using (public.is_primary_admin());

drop policy if exists "primary_admin_can_insert_action_logs" on public.admin_action_logs;
create policy "primary_admin_can_insert_action_logs"
on public.admin_action_logs for insert to authenticated
with check (public.is_primary_admin());

-- leads
drop policy if exists "primary_admin_can_manage_leads" on public.leads;
create policy "primary_admin_can_manage_leads"
on public.leads for all to authenticated
using (public.is_primary_admin())
with check (public.is_primary_admin());

-- lead_assignment_rules
drop policy if exists "primary_admin_can_manage_assignment_rules" on public.lead_assignment_rules;
create policy "primary_admin_can_manage_assignment_rules"
on public.lead_assignment_rules for all to authenticated
using (public.is_primary_admin())
with check (public.is_primary_admin());

-- lead_assignment_logs
drop policy if exists "primary_admin_can_manage_assignment_logs" on public.lead_assignment_logs;
create policy "primary_admin_can_manage_assignment_logs"
on public.lead_assignment_logs for all to authenticated
using (public.is_primary_admin())
with check (public.is_primary_admin());

-- lead_follow_up_activities
drop policy if exists "primary_admin_can_manage_follow_up_activities" on public.lead_follow_up_activities;
create policy "primary_admin_can_manage_follow_up_activities"
on public.lead_follow_up_activities for all to authenticated
using (public.is_primary_admin())
with check (public.is_primary_admin());

-- follow_up_tasks
drop policy if exists "primary_admin_can_manage_follow_up_tasks" on public.follow_up_tasks;
create policy "primary_admin_can_manage_follow_up_tasks"
on public.follow_up_tasks for all to authenticated
using (public.is_primary_admin())
with check (public.is_primary_admin());

-- crm_settings
drop policy if exists "primary_admin_can_manage_crm_settings" on public.crm_settings;
create policy "primary_admin_can_manage_crm_settings"
on public.crm_settings for all to authenticated
using (public.is_primary_admin())
with check (public.is_primary_admin());

drop policy if exists "agents_can_read_crm_settings" on public.crm_settings;
create policy "agents_can_read_crm_settings"
on public.crm_settings for select to authenticated
using (public.is_agent());

-- lead_status_change_logs
drop policy if exists "primary_admin_can_manage_lead_status_logs" on public.lead_status_change_logs;
create policy "primary_admin_can_manage_lead_status_logs"
on public.lead_status_change_logs for all to authenticated
using (public.is_primary_admin())
with check (public.is_primary_admin());

-- notifications
drop policy if exists "primary_admin_can_manage_notifications" on public.notifications;
create policy "primary_admin_can_manage_notifications"
on public.notifications for all to authenticated
using (public.is_primary_admin())
with check (public.is_primary_admin());
