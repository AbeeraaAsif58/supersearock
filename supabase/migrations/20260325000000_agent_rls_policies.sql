-- Agent RLS policies required for client-side SPA (replaces service-role bypass).

drop policy if exists "agents_can_read_assigned_leads" on public.leads;
create policy "agents_can_read_assigned_leads"
on public.leads for select to authenticated
using (assigned_agent_id = auth.uid());

drop policy if exists "agents_can_update_assigned_leads" on public.leads;
create policy "agents_can_update_assigned_leads"
on public.leads for update to authenticated
using (assigned_agent_id = auth.uid())
with check (assigned_agent_id = auth.uid());

drop policy if exists "agents_can_read_own_tasks" on public.follow_up_tasks;
create policy "agents_can_read_own_tasks"
on public.follow_up_tasks for select to authenticated
using (assigned_agent_id = auth.uid());

drop policy if exists "agents_can_manage_own_tasks" on public.follow_up_tasks;
create policy "agents_can_manage_own_tasks"
on public.follow_up_tasks for all to authenticated
using (assigned_agent_id = auth.uid())
with check (assigned_agent_id = auth.uid());

drop policy if exists "agents_can_read_own_activities" on public.lead_follow_up_activities;
create policy "agents_can_read_own_activities"
on public.lead_follow_up_activities for select to authenticated
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_id and l.assigned_agent_id = auth.uid()
  )
);

drop policy if exists "agents_can_insert_own_activities" on public.lead_follow_up_activities;
create policy "agents_can_insert_own_activities"
on public.lead_follow_up_activities for insert to authenticated
with check (
  actor_id = auth.uid()
  and exists (
    select 1 from public.leads l
    where l.id = lead_id and l.assigned_agent_id = auth.uid()
  )
);

drop policy if exists "agents_can_read_own_status_logs" on public.lead_status_change_logs;
create policy "agents_can_read_own_status_logs"
on public.lead_status_change_logs for select to authenticated
using (changed_by = auth.uid());

drop policy if exists "agents_can_insert_own_status_logs" on public.lead_status_change_logs;
create policy "agents_can_insert_own_status_logs"
on public.lead_status_change_logs for insert to authenticated
with check (changed_by = auth.uid());

drop policy if exists "agents_can_read_crm_settings" on public.crm_settings;
create policy "agents_can_read_crm_settings"
on public.crm_settings for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'agent'
  )
);

drop policy if exists "agents_can_read_assignment_logs" on public.lead_assignment_logs;
create policy "agents_can_read_assignment_logs"
on public.lead_assignment_logs for select to authenticated
using (new_agent_id = auth.uid());
