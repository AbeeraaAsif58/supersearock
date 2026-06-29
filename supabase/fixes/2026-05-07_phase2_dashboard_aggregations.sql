-- Phase 2 optimization: aggregate-heavy dashboard/report queries.

create or replace function public.get_lead_status_counts(p_assigned_agent_id uuid default null)
returns table(status public.lead_status, total bigint)
language sql
security definer
set search_path = public
as $$
  select l.status, count(*)::bigint as total
  from public.leads l
  where p_assigned_agent_id is null
     or l.assigned_agent_id = p_assigned_agent_id
  group by l.status;
$$;

create or replace function public.get_agent_performance_summary()
returns table(agent_id uuid, assigned bigint, closed bigint, completed_follow_ups bigint)
language sql
security definer
set search_path = public
as $$
  select
    p.id as agent_id,
    coalesce(l.assigned, 0)::bigint as assigned,
    coalesce(l.closed, 0)::bigint as closed,
    coalesce(t.completed, 0)::bigint as completed_follow_ups
  from public.profiles p
  left join (
    select
      assigned_agent_id,
      count(*) as assigned,
      count(*) filter (where status = 'closed') as closed
    from public.leads
    where assigned_agent_id is not null
    group by assigned_agent_id
  ) l
    on l.assigned_agent_id = p.id
  left join (
    select
      assigned_agent_id,
      count(*) as completed
    from public.follow_up_tasks
    where status = 'completed'
      and assigned_agent_id is not null
    group by assigned_agent_id
  ) t
    on t.assigned_agent_id = p.id
  where p.role = 'agent';
$$;

create or replace function public.get_lead_daily_counts(p_days int default 7)
returns table(day date, total bigint)
language sql
security definer
set search_path = public
as $$
  with series as (
    select generate_series(
      current_date - greatest(p_days, 1) + 1,
      current_date,
      interval '1 day'
    )::date as day
  )
  select
    s.day,
    coalesce(count(l.id), 0)::bigint as total
  from series s
  left join public.leads l
    on l.created_at >= s.day
   and l.created_at < (s.day + interval '1 day')
  group by s.day
  order by s.day;
$$;
