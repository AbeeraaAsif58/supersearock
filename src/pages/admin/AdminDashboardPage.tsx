"use client";

import { Link } from "react-router-dom";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { DashboardAnalytics } from "@/components/admin/dashboard-analytics";
import { DashboardRealtimeRefresh } from "@/components/admin/dashboard-realtime-refresh";
import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";
import { assertAdmin, requireAdmin } from "@/lib/auth/guards";
import type { AppNotification, LeadStatus, Profile } from "@/lib/auth/types";
import { appRedirect } from "@/lib/navigation";
import { createDataClient } from "@/lib/supabase/client";

const pipelineStages: LeadStatus[] = ["new", "assigned", "follow_up", "interested", "call_denied", "closed", "lost"];

async function loadPageData() {
  const { profile } = await assertAdmin();
  const adminClient = createDataClient();
  const now = new Date();
  const dayAgo = new Date(now);
  dayAgo.setDate(dayAgo.getDate() - 1);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [allAgentsRes, statusCountsRes, agentSummaryRes, dailyCountsRes, dailyLeadsRes, weeklyLeadsRes, monthlyLeadsRes, notificationsRes] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id,email,role,status,is_primary_admin,created_at,updated_at")
      .eq("role", "agent")
      .order("email", { ascending: true })
      .returns<Profile[]>(),
    adminClient.rpc("get_lead_status_counts"),
    adminClient.rpc("get_agent_performance_summary"),
    adminClient.rpc("get_lead_daily_counts", { p_days: 7 }),
    adminClient
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo.toISOString()),
    adminClient
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString()),
    adminClient
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthAgo.toISOString()),
    adminClient
      .from("notifications")
      .select("id,user_id,title,message,notification_type,entity_type,entity_id,is_read,read_at,created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(15)
      .returns<AppNotification[]>(),
  ]);

  const allAgents = allAgentsRes.data ?? [];
  const totalAgents = allAgents.length;
  const activeAgents = allAgents.filter((agent) => agent.status === "active").length;
  const blockedAgents = allAgents.filter((agent) => agent.status === "blocked").length;
  const readonlyAgents = allAgents.filter((agent) => agent.status === "readonly").length;
  const recentAgents = [...allAgents]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
  const notifications = notificationsRes.data ?? [];
  const unreadNotificationsCount = notifications.filter((item) => !item.is_read).length;

  const dailyLeads = dailyLeadsRes.count ?? 0;
  const weeklyLeads = weeklyLeadsRes.count ?? 0;
  const monthlyLeads = monthlyLeadsRes.count ?? 0;

  const statusCounts = Object.fromEntries(pipelineStages.map((stage) => [stage, 0])) as Record<LeadStatus, number>;
  for (const row of (statusCountsRes.data ?? []) as Array<{ status: LeadStatus; total: number | string }>) {
    statusCounts[row.status] = Number(row.total ?? 0);
  }
  const totalLeads = pipelineStages.reduce((sum, stage) => sum + (statusCounts[stage] ?? 0), 0);
  const totalClosedOrLost = statusCounts.closed + statusCounts.lost;
  const overallConversionRate = totalLeads > 0 ? Math.round((statusCounts.closed / totalLeads) * 100) : 0;

  const agentSummaryById = new Map(
    ((agentSummaryRes.data ?? []) as Array<{ agent_id: string; assigned: number | string; closed: number | string; completed_follow_ups: number | string }>).map((row) => [
      row.agent_id,
      {
        assigned: Number(row.assigned ?? 0),
        closed: Number(row.closed ?? 0),
        completedFollowUps: Number(row.completed_follow_ups ?? 0),
      },
    ]),
  );

  const agentPerformance = allAgents
    .map((agent) => {
      const summary = agentSummaryById.get(agent.id);
      const assigned = summary?.assigned ?? 0;
      const completedFollowUps = summary?.completedFollowUps ?? 0;
      const closed = summary?.closed ?? 0;
      const conversionRate = assigned > 0 ? Math.round((closed / assigned) * 100) : 0;
      return { ...agent, assigned, closed, completedFollowUps, conversionRate };
    })
    .sort((a, b) => b.assigned - a.assigned);

  const last7DaysLabels: string[] = [];
  const last7DaysCounts: number[] = [];
  const dailyCountsByDate = new Map(
    ((dailyCountsRes.data ?? []) as Array<{ day: string; total: number | string }>).map((row) => [
      row.day,
      Number(row.total ?? 0),
    ]),
  );
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const isoDate = day.toISOString().slice(0, 10);
    last7DaysLabels.push(day.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
    last7DaysCounts.push(dailyCountsByDate.get(isoDate) ?? 0);
  }

  return {
    totalAgents,
    activeAgents,
    readonlyAgents,
    blockedAgents,
    dailyLeads,
    weeklyLeads,
    monthlyLeads,
    statusCounts,
    totalLeads,
    totalClosedOrLost,
    overallConversionRate,
    agentPerformance,
    last7DaysLabels,
    last7DaysCounts,
    recentAgents,
    notifications,
    unreadNotificationsCount,
  };
}

export default function AdminDashboardPage() {
  const { data, loading, reload } = usePageLoader(() => loadPageData(), []);

  async function markAllAdminNotificationsReadAction() {
    const { profile } = await requireAdmin();
    const adminClient = createDataClient();
    await adminClient
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", profile.id)
      .eq("is_read", false);
    reload();
    appRedirect("/admin/dashboard");
  }

  async function markSingleAdminNotificationReadAction(formData: FormData) {
    const { profile } = await requireAdmin();
    const adminClient = createDataClient();
    const notificationId = String(formData.get("notification_id") ?? "");
    if (!notificationId) {
      appRedirect("/admin/dashboard");
      return;
    }
    await adminClient
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", profile.id);
    reload();
    appRedirect("/admin/dashboard");
  }

  if (loading || !data) return <PageLoadingState />;

  const {
    totalAgents,
    activeAgents,
    readonlyAgents,
    blockedAgents,
    dailyLeads,
    weeklyLeads,
    monthlyLeads,
    statusCounts,
    totalLeads,
    totalClosedOrLost,
    overallConversionRate,
    agentPerformance,
    last7DaysLabels,
    last7DaysCounts,
    recentAgents,
    notifications,
    unreadNotificationsCount,
  } = data;

  return (
    <div className="space-y-6">
      <DashboardRealtimeRefresh onRefresh={reload} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl tracking-tight text-[#1A1A1A]">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Lead operations, agent controls, and follow-up health.
          </p>
        </div>
        <Link
          to="/admin/agents"
          className="rounded-xl bg-[#E55B3C] px-4 py-2.5 text-sm text-white hover:bg-[#c94b2f]"
        >
          Manage agents
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Agents", value: totalAgents, hint: "All created agents" },
          { label: "Active Agents", value: activeAgents, hint: "Can login + update" },
          { label: "Read-only Agents", value: readonlyAgents, hint: "Restricted by admin" },
          { label: "Blocked Agents", value: blockedAgents, hint: "Login disabled" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-[#E0DDD9] bg-white p-4">
            <p className="text-xs uppercase tracking-widest text-gray-500">{item.label}</p>
            <p className="mt-2 text-3xl tracking-tight text-[#1A1A1A]">{item.value}</p>
            <p className="mt-1 text-xs text-gray-500">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { label: "Daily Leads", value: dailyLeads, hint: "Last 24 hours" },
          { label: "Weekly Leads", value: weeklyLeads, hint: "Last 7 days" },
          { label: "Monthly Leads", value: monthlyLeads, hint: "Last 30 days" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-[#E0DDD9] bg-white p-4">
            <p className="text-xs uppercase tracking-widest text-gray-500">{item.label}</p>
            <p className="mt-2 text-3xl tracking-tight text-[#1A1A1A]">{item.value}</p>
            <p className="mt-1 text-xs text-gray-500">{item.hint}</p>
          </div>
        ))}
      </div>

      <DashboardAnalytics
        pipelineStages={pipelineStages}
        statusCounts={statusCounts}
        dailyTrendLabels={last7DaysLabels}
        dailyTrendValues={last7DaysCounts}
        agentPerformance={agentPerformance.slice(0, 8).map((agent) => ({
          id: agent.id,
          email: agent.email,
          status: agent.status,
          assigned: agent.assigned,
          completedFollowUps: agent.completedFollowUps,
          closed: agent.closed,
          conversionRate: agent.conversionRate,
        }))}
      />

      <div className="rounded-xl border border-[#E0DDD9] bg-white p-5">
        <h2 className="text-xl tracking-tight text-[#1A1A1A]">Pipeline Analytics</h2>
        <p className="mt-1 text-sm text-gray-500">
          New to Closed/Lost flow with stage volumes.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {pipelineStages.map((stage, index) => {
            const count = statusCounts[stage] ?? 0;
            const width = totalLeads > 0 ? Math.max(8, Math.round((count / totalLeads) * 100)) : 0;
            return (
              <div key={stage} className="rounded-lg border border-[#ECE8E2] bg-[#FAF9F7] p-3">
                <p className="text-[11px] uppercase tracking-widest text-[#E55B3C]">{`Stage 0${index + 1}`}</p>
                <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{stage.replace("_", " ")}</p>
                <p className="mt-1 text-lg font-semibold text-[#1A1A1A]">{count}</p>
                <div className="mt-2 h-1.5 rounded-full bg-[#E7E2DA]">
                  <div className="h-1.5 rounded-full bg-[#E55B3C]" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[#ECE8E2] bg-[#FAF9F7] p-3">
            <p className="text-xs text-gray-500">Overall Conversion Rate</p>
            <p className="text-2xl font-semibold text-[#1A1A1A]">{overallConversionRate}%</p>
          </div>
          <div className="rounded-lg border border-[#ECE8E2] bg-[#FAF9F7] p-3">
            <p className="text-xs text-gray-500">Closed / Lost</p>
            <p className="text-2xl font-semibold text-[#1A1A1A]">
              {statusCounts.closed} / {statusCounts.lost}
            </p>
          </div>
          <div className="rounded-lg border border-[#ECE8E2] bg-[#FAF9F7] p-3">
            <p className="text-xs text-gray-500">Final-Stage Volume</p>
            <p className="text-2xl font-semibold text-[#1A1A1A]">{totalClosedOrLost}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E0DDD9] bg-white p-5">
        <h3 className="text-lg tracking-tight text-[#1A1A1A]">Lead Status Breakdown</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {pipelineStages.map((status) => {
            const count = statusCounts[status] ?? 0;
            const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
            return (
              <div key={status} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
                <p className="text-xs uppercase tracking-widest text-gray-500">{status.replace("_", " ")}</p>
                <p className="mt-1 text-xl font-semibold text-[#1A1A1A]">{count}</p>
                <p className="text-xs text-gray-500">{pct}% of total leads</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[#E0DDD9] bg-white p-5">
        <h3 className="text-lg tracking-tight text-[#1A1A1A]">Agent Performance</h3>
        <p className="mt-1 text-sm text-gray-500">
          Assigned leads, completed follow-ups, and conversion rate by agent.
        </p>
        <div className="mt-4 space-y-2">
          {agentPerformance.length === 0 && (
            <p className="text-sm text-gray-500">No agent performance data available yet.</p>
          )}
          {agentPerformance.map((agent) => (
            <div key={agent.id} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#1A1A1A]">{agent.email}</p>
                <span className="text-xs uppercase tracking-wider text-gray-500">{agent.status}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-white px-2 py-1.5">
                  <p className="text-gray-500">Assigned</p>
                  <p className="font-semibold text-[#1A1A1A]">{agent.assigned}</p>
                </div>
                <div className="rounded-md bg-white px-2 py-1.5">
                  <p className="text-gray-500">Completed Follow-ups</p>
                  <p className="font-semibold text-[#1A1A1A]">{agent.completedFollowUps}</p>
                </div>
                <div className="rounded-md bg-white px-2 py-1.5">
                  <p className="text-gray-500">Conversion</p>
                  <p className="font-semibold text-[#1A1A1A]">{agent.conversionRate}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-[#E0DDD9] bg-white p-5">
          <h3 className="text-lg tracking-tight text-[#1A1A1A]">Recent Agents</h3>
          <p className="mt-1 text-sm text-gray-500">Latest invited agent accounts.</p>
          <div className="mt-4 space-y-2">
            {recentAgents.length === 0 && <p className="text-sm text-gray-500">No agents found yet.</p>}
            {recentAgents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3 text-sm text-[#1A1A1A]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{agent.email}</span>
                  <span className="text-xs uppercase tracking-widest text-gray-500">{agent.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#E0DDD9] bg-white p-5">
          <h3 className="text-lg tracking-tight text-[#1A1A1A]">Analytics Quick Links</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>- Status and conversion reports in Reports module</li>
            <li>- Follow-up completion trends and overdue pressure</li>
            <li>- Agent-level funnel outcomes and closure quality</li>
            <li>- Pipeline stage movement for weekly review meetings</li>
          </ul>
          <Link
            to="/admin/reports"
            className="mt-4 inline-flex rounded-lg bg-[#E55B3C] px-4 py-2 text-sm text-white hover:bg-[#c94b2f]"
          >
            Open reports
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-[#E0DDD9] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg tracking-tight text-[#1A1A1A]">Notifications</h3>
            <p className="text-sm text-gray-500">
              {unreadNotificationsCount} unread of {notifications.length}
            </p>
          </div>
          <form action={markAllAdminNotificationsReadAction}>
            <AdminFormSubmitButton
              idleText="Mark all read"
              pendingText="Marking..."
              variant="outline"
              className="rounded-md border border-[#E0DDD9] px-3 py-1.5 text-xs text-[#1A1A1A] hover:bg-[#F4F1ED]"
            />
          </form>
        </div>
        <div className="mt-3 space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {notifications.length === 0 && <p className="text-sm text-gray-500">No notifications yet.</p>}
          {notifications.map((item) => (
            <div key={item.id} className={`rounded-lg border p-3 ${item.is_read ? "border-[#EAE7E2] bg-[#FAF9F7]" : "border-[#FAD7CE] bg-[#FFF5F2]"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[#1A1A1A]">{item.title}</p>
                  <p className="mt-1 text-xs text-gray-600">{item.message}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{new Date(item.created_at).toLocaleString()}</p>
                </div>
                {!item.is_read && (
                  <form action={markSingleAdminNotificationReadAction}>
                    <input type="hidden" name="notification_id" value={item.id} />
                    <AdminFormSubmitButton
                      idleText="Mark read"
                      pendingText="Marking..."
                      variant="outline"
                      className="rounded-md border border-[#E0DDD9] px-2 py-1 text-[11px] text-[#1A1A1A] hover:bg-[#F4F1ED]"
                    />
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
