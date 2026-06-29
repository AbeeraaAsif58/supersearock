"use client";

import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { assertActiveAgent, assertAgent, requireActiveAgent } from "@/lib/auth/guards";
import type { AppNotification, LeadStatus, Profile } from "@/lib/auth/types";
import { createDataClient, createClient } from "@/lib/supabase/client";
import { appRedirect } from "@/lib/navigation";
import { AgentProductivityAnalytics } from "@/components/agent/agent-productivity-analytics";
import { AgentRealtimeRefresh } from "@/components/agent/agent-realtime-refresh";
import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";

const pipelineStages: LeadStatus[] = [
  "new",
  "assigned",
  "follow_up",
  "interested",
  "call_denied",
  "closed",
  "lost",
];

type DashboardData = {
  profile: Profile;
  myNotifications: AppNotification[];
  unreadNotificationsCount: number;
  totalNotifications: number;
  assignedLeadsCount: number;
  pendingFollowUpsCount: number;
  overdueCount: number;
  conversionsPercent: number;
  pipelineCounts: Record<LeadStatus, number>;
  weeklyLabels: string[];
  weeklyCompletedValues: number[];
  weeklyClosedValues: number[];
  dueSoonTasks: Array<{ id: string; due_at: string }>;
  overdueTasks: Array<{ id: string; due_at: string }>;
  thisWeekCompleted: number;
  previousWeekCompleted: number;
  completedDelta: number;
  thisWeekClosed: number;
  previousWeekClosed: number;
  closedDelta: number;
  dueTodayCount: number;
  completedTodayCount: number;
  now: Date;
};

async function loadDashboardData(): Promise<DashboardData> {
  const { profile } = await assertAgent();
  const dataClient = createDataClient();
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const startOfThisWeek = new Date(startOfToday);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - startOfThisWeek.getDay());
  const startOfPreviousWeek = new Date(startOfThisWeek);
  startOfPreviousWeek.setDate(startOfPreviousWeek.getDate() - 7);

  const [
    { data: tasks },
    { data: notifications },
    pipelineCountsRes,
    { data: statusChangeLogs },
    { count: totalNotificationsCount },
    { count: unreadNotificationsCountDb },
  ] = await Promise.all([
    dataClient
      .from("follow_up_tasks")
      .select("id,status,due_at,completed_at")
      .eq("assigned_agent_id", profile.id)
      .returns<
        Array<{
          id: string;
          status: string;
          due_at: string;
          completed_at: string | null;
        }>
      >(),
    dataClient
      .from("notifications")
      .select("id,user_id,title,message,notification_type,entity_type,entity_id,is_read,read_at,created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(15)
      .returns<AppNotification[]>(),
    dataClient.rpc("get_lead_status_counts", { p_assigned_agent_id: profile.id }),
    dataClient
      .from("lead_status_change_logs")
      .select("id,new_status,changed_by,created_at")
      .eq("changed_by", profile.id)
      .eq("new_status", "closed")
      .gte("created_at", startOfPreviousWeek.toISOString())
      .returns<Array<{ id: string; new_status: LeadStatus; changed_by: string; created_at: string }>>(),
    dataClient
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id),
    dataClient
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false),
  ]);

  const allTasks = tasks ?? [];
  const dueTodayCount = allTasks.filter((task) => {
    if (task.status !== "pending") return false;
    const dueAt = new Date(task.due_at);
    return dueAt >= startOfToday && dueAt < endOfToday;
  }).length;
  const overdueCount = allTasks.filter((task) => {
    if (task.status !== "pending") return false;
    return new Date(task.due_at) < now;
  }).length;
  const completedTodayCount = allTasks.filter((task) => {
    if (task.status !== "completed" || !task.completed_at) return false;
    const completedAt = new Date(task.completed_at);
    return completedAt >= startOfToday && completedAt < endOfToday;
  }).length;
  const closeLogs = statusChangeLogs ?? [];
  const pipelineCounts = Object.fromEntries(
    pipelineStages.map((stage) => [stage, 0]),
  ) as Record<LeadStatus, number>;
  for (const row of (pipelineCountsRes.data ?? []) as Array<{ status: LeadStatus; total: number | string }>) {
    pipelineCounts[row.status] = Number(row.total ?? 0);
  }
  const assignedLeadsCount = pipelineStages.reduce(
    (sum, stage) => sum + (pipelineCounts[stage] ?? 0),
    0,
  );
  const pendingFollowUpsCount = allTasks.filter((task) => task.status === "pending").length;
  const closedLeadsCount = pipelineCounts.closed ?? 0;
  const conversionsPercent = assignedLeadsCount > 0 ? Math.round((closedLeadsCount / assignedLeadsCount) * 100) : 0;

  const thisWeekCompleted = allTasks.filter((task) => {
    if (task.status !== "completed" || !task.completed_at) return false;
    const completedAt = new Date(task.completed_at);
    return completedAt >= startOfThisWeek && completedAt < now;
  }).length;

  const previousWeekCompleted = allTasks.filter((task) => {
    if (task.status !== "completed" || !task.completed_at) return false;
    const completedAt = new Date(task.completed_at);
    return completedAt >= startOfPreviousWeek && completedAt < startOfThisWeek;
  }).length;

  const thisWeekClosed = closeLogs.filter((log) => {
    const changedAt = new Date(log.created_at);
    return changedAt >= startOfThisWeek && changedAt < now;
  }).length;
  const previousWeekClosed = closeLogs.filter((log) => {
    const changedAt = new Date(log.created_at);
    return changedAt >= startOfPreviousWeek && changedAt < startOfThisWeek;
  }).length;

  const weeklyLabels: string[] = [];
  const weeklyCompletedValues: number[] = [];
  const weeklyClosedValues: number[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    weeklyLabels.push(day.toLocaleDateString(undefined, { weekday: "short" }));
    weeklyCompletedValues.push(
      allTasks.filter((task) => {
        if (task.status !== "completed" || !task.completed_at) return false;
        const completedAt = new Date(task.completed_at);
        return completedAt >= day && completedAt < nextDay;
      }).length,
    );
    weeklyClosedValues.push(
      closeLogs.filter((log) => {
        const changedAt = new Date(log.created_at);
        return changedAt >= day && changedAt < nextDay;
      }).length,
    );
  }

  const completedDelta = thisWeekCompleted - previousWeekCompleted;
  const closedDelta = thisWeekClosed - previousWeekClosed;
  const dueSoonTasks = allTasks.filter((task) => {
    if (task.status !== "pending") return false;
    const dueAt = new Date(task.due_at);
    return dueAt >= now && dueAt < new Date(now.getTime() + 24 * 60 * 60 * 1000);
  });
  const overdueTasks = allTasks.filter((task) => task.status === "pending" && new Date(task.due_at) < now);

  return {
    profile,
    myNotifications: notifications ?? [],
    unreadNotificationsCount: unreadNotificationsCountDb ?? 0,
    totalNotifications: totalNotificationsCount ?? 0,
    assignedLeadsCount,
    pendingFollowUpsCount,
    overdueCount,
    conversionsPercent,
    pipelineCounts,
    weeklyLabels,
    weeklyCompletedValues,
    weeklyClosedValues,
    dueSoonTasks,
    overdueTasks,
    thisWeekCompleted,
    previousWeekCompleted,
    completedDelta,
    thisWeekClosed,
    previousWeekClosed,
    closedDelta,
    dueTodayCount,
    completedTodayCount,
    now,
  };
}

async function markAllAgentNotificationsReadAction() {
  const { profile } = await requireActiveAgent();
  const dataClient = createDataClient();
  await dataClient
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .eq("is_read", false);
  appRedirect("/dashboard");
}

async function markSingleAgentNotificationReadAction(formData: FormData) {
  const { profile } = await requireActiveAgent();
  const dataClient = createDataClient();
  const notificationId = String(formData.get("notification_id") ?? "");
  if (!notificationId) {
    appRedirect("/dashboard");
    return;
  }
  await dataClient
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", profile.id);
  appRedirect("/dashboard");
}

async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  appRedirect("/login");
}

export default function AgentDashboardPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error") ? decodeURIComponent(searchParams.get("error")!) : undefined;
  const { data, loading, error: loadError, reload } = usePageLoader(loadDashboardData, []);

  if (loading) return <PageLoadingState />;
  if (loadError || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-red-600">
        {loadError ?? "Failed to load dashboard."}
      </div>
    );
  }

  const {
    profile,
    myNotifications,
    unreadNotificationsCount,
    totalNotifications,
    assignedLeadsCount,
    pendingFollowUpsCount,
    overdueCount,
    conversionsPercent,
    pipelineCounts,
    weeklyLabels,
    weeklyCompletedValues,
    weeklyClosedValues,
    dueSoonTasks,
    overdueTasks,
    thisWeekCompleted,
    previousWeekCompleted,
    completedDelta,
    thisWeekClosed,
    previousWeekClosed,
    closedDelta,
    dueTodayCount,
    completedTodayCount,
    now,
  } = data;

  return (
    <main className="min-h-screen bg-[#F4F1ED] p-2 md:p-3">
      <AgentRealtimeRefresh agentId={profile.id} onRefresh={reload} />
      <div className="mx-auto grid w-full max-w-[98vw] grid-cols-1 gap-3 lg:grid-cols-[300px_1fr]">
        <aside className="sticky top-2 md:top-3 h-[calc(100vh-1rem)] md:h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl border border-[#E0DDD9] bg-white/70 p-5 md:p-6">
          <div className="border-b border-[#EAE7E2] pb-4">
            <p className="text-xs uppercase tracking-[0.25em] text-[#E55B3C]">Super Sea Rock Real Estate</p>
            <h2 className="mt-2 text-xl tracking-tight text-[#1A1A1A]">Agent Workspace</h2>
          </div>

          <nav className="mt-5 space-y-1.5">
            <Link
              to="/dashboard"
              className="block rounded-xl bg-[#E55B3C] px-3.5 py-3 text-base text-white"
            >
              Dashboard
            </Link>
            <Link
              to="/dashboard/leads"
              className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]"
            >
              My Leads
            </Link>
            <Link
              to="/dashboard/follow-ups"
              className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]"
            >
              Follow-ups
            </Link>
            <Link
              to="/dashboard/notifications"
              className="flex items-center justify-between rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]"
            >
              <span>Notifications</span>
              {unreadNotificationsCount > 0 && (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#E55B3C]/10 px-2 py-0.5 text-xs font-semibold text-[#E55B3C]">
                  {unreadNotificationsCount}
                </span>
              )}
            </Link>
            <Link
              to="/dashboard/settings"
              className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]"
            >
              Settings
            </Link>
          </nav>

          <div className="mt-6 rounded-xl border border-[#EAE7E2] bg-[#F9F8F6] p-3 text-xs text-gray-600">
            Signed in as:
            <p className="mt-1 truncate font-medium text-[#1A1A1A]">{profile.email}</p>
          </div>

          <form action={signOutAction} className="mt-5">
            <AdminFormSubmitButton
              idleText="Logout"
              pendingText="Logging out..."
              variant="outline"
              className="w-full rounded-xl border border-[#E0DDD9] px-3 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]"
            />
          </form>
        </aside>

        <section className="rounded-2xl border border-[#E0DDD9] bg-white/70 p-5 md:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl tracking-tight text-[#1A1A1A]">Welcome, Agent</h1>
            <Button type="button" variant="outline" className="pointer-events-none">
              Agent Dashboard
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Agent Profile</CardTitle>
              <CardDescription>
                Personal workspace access and account status.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
                <p className="text-xs uppercase tracking-widest text-gray-500">Role</p>
                <p className="mt-1 font-medium text-[#1A1A1A]">{profile.role}</p>
              </div>
              <div className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
                <p className="text-xs uppercase tracking-widest text-gray-500">Email</p>
                <p className="mt-1 font-medium text-[#1A1A1A] break-all">{profile.email}</p>
              </div>
              <div className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
                <p className="text-xs uppercase tracking-widest text-gray-500">Status</p>
                <p className="mt-1 font-medium text-[#1A1A1A]">
                  {profile.status}
                  {profile.status === "readonly" ? " (read-only mode)" : ""}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                {unreadNotificationsCount} unread of {totalNotifications}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <form action={markAllAgentNotificationsReadAction}>
                  <AdminFormSubmitButton
                    idleText="Mark all read"
                    pendingText="Marking..."
                    variant="outline"
                    className="rounded-md border border-[#E0DDD9] px-3 py-1.5 text-xs text-[#1A1A1A] hover:bg-[#F4F1ED]"
                  />
                </form>
              </div>
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {myNotifications.length === 0 && <p className="text-sm text-gray-500">No notifications yet.</p>}
                {myNotifications.map((item) => (
                  <div key={item.id} className={`rounded-lg border p-3 ${item.is_read ? "border-[#EAE7E2] bg-[#FAF9F7]" : "border-[#FAD7CE] bg-[#FFF5F2]"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[#1A1A1A]">{item.title}</p>
                        <p className="mt-1 text-xs text-gray-600">{item.message}</p>
                        <p className="mt-1 text-[11px] text-gray-500">{new Date(item.created_at).toLocaleString()}</p>
                      </div>
                      {!item.is_read && (
                        <form action={markSingleAgentNotificationReadAction}>
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
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Productivity KPIs</CardTitle>
              <CardDescription>
                Assigned leads, pending follow-ups, overdue, and conversion performance.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
                <p className="text-xs uppercase tracking-widest text-gray-500">Assigned Leads</p>
                <p className="mt-1 text-2xl font-semibold text-[#1A1A1A]">{assignedLeadsCount}</p>
              </div>
              <div className="rounded-lg border border-[#EAE7E2] bg-[#FFFBEB] p-3">
                <p className="text-xs uppercase tracking-widest text-[#92400E]">Pending Follow-ups</p>
                <p className="mt-1 text-2xl font-semibold text-[#1A1A1A]">{pendingFollowUpsCount}</p>
              </div>
              <div className="rounded-lg border border-[#EAE7E2] bg-[#FEF2F2] p-3">
                <p className="text-xs uppercase tracking-widest text-[#991B1B]">Overdue</p>
                <p className="mt-1 text-2xl font-semibold text-[#1A1A1A]">{overdueCount}</p>
              </div>
              <div className="rounded-lg border border-[#EAE7E2] bg-[#ECFDF3] p-3">
                <p className="text-xs uppercase tracking-widest text-[#166534]">Conversions</p>
                <p className="mt-1 text-2xl font-semibold text-[#1A1A1A]">{conversionsPercent}%</p>
              </div>
            </CardContent>
          </Card>

          <AgentProductivityAnalytics
            pipelineStages={pipelineStages}
            pipelineCounts={pipelineCounts}
            weeklyLabels={weeklyLabels}
            weeklyCompletedValues={weeklyCompletedValues}
            weeklyClosedValues={weeklyClosedValues}
          />

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>In-App Reminder Feed</CardTitle>
              <CardDescription>Due soon and overdue follow-ups requiring action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {dueSoonTasks.length === 0 && overdueTasks.length === 0 && (
                <p className="text-sm text-gray-500">No reminders right now.</p>
              )}
              {[...overdueTasks, ...dueSoonTasks].slice(0, 10).map((task) => (
                <div key={task.id} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
                  <p className="text-sm font-medium text-[#1A1A1A]">Task #{task.id.slice(0, 8)}</p>
                  <p className="mt-1 text-xs text-gray-600">Due: {new Date(task.due_at).toLocaleString()}</p>
                  <p className={`mt-1 text-xs ${new Date(task.due_at) < now ? "text-red-700" : "text-amber-700"}`}>
                    {new Date(task.due_at) < now ? "Overdue" : "Due within 24h"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Performance Snapshot vs Previous Week</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
                <p className="text-xs uppercase tracking-widest text-gray-500">Completed Follow-ups</p>
                <p className="mt-1 text-2xl font-semibold text-[#1A1A1A]">{thisWeekCompleted}</p>
                <p className={`mt-1 text-xs ${completedDelta >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {completedDelta >= 0 ? "+" : ""}
                  {completedDelta} vs previous week ({previousWeekCompleted})
                </p>
              </div>
              <div className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
                <p className="text-xs uppercase tracking-widest text-gray-500">Closed Leads</p>
                <p className="mt-1 text-2xl font-semibold text-[#1A1A1A]">{thisWeekClosed}</p>
                <p className={`mt-1 text-xs ${closedDelta >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {closedDelta >= 0 ? "+" : ""}
                  {closedDelta} vs previous week ({previousWeekClosed})
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>My Day Overview</CardTitle>
              <CardDescription>
                Live follow-up workload for your current day.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-[#EAE7E2] bg-[#FFFBEB] p-3">
                <p className="text-xs uppercase tracking-widest text-[#92400E]">Due Today</p>
                <p className="mt-1 text-2xl font-semibold text-[#1A1A1A]">{dueTodayCount}</p>
              </div>
              <div className="rounded-lg border border-[#EAE7E2] bg-[#FEF2F2] p-3">
                <p className="text-xs uppercase tracking-widest text-[#991B1B]">Overdue</p>
                <p className="mt-1 text-2xl font-semibold text-[#1A1A1A]">{overdueCount}</p>
              </div>
              <div className="rounded-lg border border-[#EAE7E2] bg-[#ECFDF3] p-3">
                <p className="text-xs uppercase tracking-widest text-[#166534]">Completed Today</p>
                <p className="mt-1 text-2xl font-semibold text-[#1A1A1A]">{completedTodayCount}</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
