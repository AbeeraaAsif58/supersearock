"use client";

import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { SearchableLeadSelect } from "@/components/agent/searchable-lead-select";
import { requireActiveAgent, requireAgent } from "@/lib/auth/guards";
import type { Profile } from "@/lib/auth/types";
import { AgentRealtimeRefresh } from "@/components/agent/agent-realtime-refresh";
import { createDataClient, createClient } from "@/lib/supabase/client";
import { appRedirect } from "@/lib/navigation";
import { sendManualFollowUpEmail } from "@/lib/email/client";
import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";

type FollowUpTask = {
  id: string;
  lead_id: string;
  title: string;
  task_type: string;
  due_at: string;
  status: string;
  reminder_enabled: boolean;
  completed_at: string | null;
  notes: string | null;
  assigned_agent_id: string | null;
};

type FollowUpActivity = {
  id: string;
  lead_id: string;
  activity_type: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type LeadSummary = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  assigned_agent_id: string | null;
};

type FollowUpsPageData = {
  profile: Profile;
  myLeads: LeadSummary[];
  myTasks: FollowUpTask[];
  myActivities: FollowUpActivity[];
  unreadCount: number;
  leadNameById: Map<string, string>;
  pendingTasks: FollowUpTask[];
  completedTasks: FollowUpTask[];
  missedTasks: FollowUpTask[];
  dueSoonTasks: FollowUpTask[];
  overdueTasks: FollowUpTask[];
  scheduledFutureTasks: FollowUpTask[];
  now: Date;
};

async function loadFollowUpsPageData(): Promise<FollowUpsPageData> {
  const { profile } = await requireAgent();
  const dataClient = createDataClient();

  const [{ data: leads }, { data: tasks }, { data: activities }, { count: unreadNotificationsCount = 0 }] =
    await Promise.all([
      dataClient
        .from("leads")
        .select("id,full_name,email,phone,status,assigned_agent_id")
        .eq("assigned_agent_id", profile.id)
        .order("updated_at", { ascending: false })
        .returns<LeadSummary[]>(),
      dataClient
        .from("follow_up_tasks")
        .select("id,lead_id,title,task_type,due_at,status,reminder_enabled,completed_at,notes,assigned_agent_id")
        .eq("assigned_agent_id", profile.id)
        .order("due_at", { ascending: true })
        .returns<FollowUpTask[]>(),
      dataClient
        .from("lead_follow_up_activities")
        .select("id,lead_id,activity_type,content,metadata,created_at")
        .eq("actor_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<FollowUpActivity[]>(),
      dataClient
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("is_read", false),
    ]);

  const myLeads = leads ?? [];
  const myTasks = tasks ?? [];
  const myActivities = activities ?? [];
  const now = new Date();
  const leadNameById = new Map(myLeads.map((lead) => [lead.id, lead.full_name]));
  const pendingTasks = myTasks.filter((task) => task.status === "pending");
  const completedTasks = myTasks.filter((task) => task.status === "completed");
  const missedTasks = myTasks.filter((task) => task.status === "missed");
  const dueSoonTasks = pendingTasks.filter((task) => {
    const dueAt = new Date(task.due_at);
    return dueAt >= now && dueAt < new Date(now.getTime() + 24 * 60 * 60 * 1000);
  });
  const overdueTasks = pendingTasks.filter((task) => new Date(task.due_at) < now);
  const scheduledFutureTasks = pendingTasks.filter(
    (task) => new Date(task.due_at) >= new Date(now.getTime() + 24 * 60 * 60 * 1000),
  );

  return {
    profile,
    myLeads,
    myTasks,
    myActivities,
    unreadCount: unreadNotificationsCount ?? 0,
    leadNameById,
    pendingTasks,
    completedTasks,
    missedTasks,
    dueSoonTasks,
    overdueTasks,
    scheduledFutureTasks,
    now,
  };
}

async function createTimelineEntryAction(formData: FormData) {
  const { profile } = await requireActiveAgent();
  const dataClient = createDataClient();
  const leadId = String(formData.get("lead_id") ?? "");
  const activityType = String(formData.get("activity_type") ?? "note");
  const content = String(formData.get("content") ?? "").trim();

  if (!leadId || !content) {
    appRedirect("/dashboard/follow-ups?error=Lead%20and%20content%20are%20required.");
    return;
  }

  const { data: lead } = await dataClient
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("assigned_agent_id", profile.id)
    .maybeSingle<{ id: string }>();
  if (!lead) {
    appRedirect("/dashboard/follow-ups?error=Lead%20is%20not%20assigned%20to%20you.");
    return;
  }

  const { error } = await dataClient.from("lead_follow_up_activities").insert({
    lead_id: leadId,
    actor_id: profile.id,
    activity_type: activityType,
    content,
    metadata: {},
  });

  if (error) {
    appRedirect(`/dashboard/follow-ups?error=${encodeURIComponent(error.message)}`);
    return;
  }

  appRedirect("/dashboard/follow-ups?message=Timeline%20entry%20added.");
}

async function createFollowUpTaskAction(formData: FormData) {
  const { profile } = await requireActiveAgent();
  const dataClient = createDataClient();

  const leadId = String(formData.get("lead_id") ?? "");
  const taskType = String(formData.get("task_type") ?? "follow_up");
  const title = String(formData.get("title") ?? "").trim();
  const notes = normalizeOptional(String(formData.get("notes") ?? ""));
  const nextFollowUpAtRaw = String(formData.get("next_follow_up_at") ?? "");
  const reminderEnabled = formData.get("reminder_enabled") === "on";

  if (!leadId || !title || !nextFollowUpAtRaw) {
    appRedirect("/dashboard/follow-ups?error=Lead,%20title,%20and%20next%20follow-up%20date%20are%20required.");
    return;
  }

  const { data: lead } = await dataClient
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("assigned_agent_id", profile.id)
    .maybeSingle<{ id: string }>();
  if (!lead) {
    appRedirect("/dashboard/follow-ups?error=Lead%20is%20not%20assigned%20to%20you.");
    return;
  }

  const nextFollowUpAt = new Date(nextFollowUpAtRaw);
  if (Number.isNaN(nextFollowUpAt.getTime())) {
    appRedirect("/dashboard/follow-ups?error=Invalid%20next%20follow-up%20date.");
    return;
  }

  const { error } = await dataClient.from("follow_up_tasks").insert({
    lead_id: leadId,
    assigned_agent_id: profile.id,
    title,
    task_type: taskType,
    notes,
    scheduled_for: new Date().toISOString(),
    due_at: nextFollowUpAt.toISOString(),
    status: "pending",
    reminder_enabled: reminderEnabled,
    reminder_sent_at: reminderEnabled ? null : new Date().toISOString(),
    created_by: profile.id,
  });

  if (error) {
    appRedirect(`/dashboard/follow-ups?error=${encodeURIComponent(error.message)}`);
    return;
  }

  appRedirect("/dashboard/follow-ups?message=Follow-up%20task%20created.");
}

async function markTaskStatusAction(formData: FormData) {
  const { profile } = await requireActiveAgent();
  const dataClient = createDataClient();
  const taskId = String(formData.get("task_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!taskId || (status !== "completed" && status !== "missed")) {
    appRedirect("/dashboard/follow-ups?error=Invalid%20task%20status%20update.");
    return;
  }

  const updatePayload =
    status === "completed"
      ? { status: "completed", completed_at: new Date().toISOString() }
      : { status: "missed" };

  const { error } = await dataClient
    .from("follow_up_tasks")
    .update(updatePayload)
    .eq("id", taskId)
    .eq("assigned_agent_id", profile.id);

  if (error) {
    appRedirect(`/dashboard/follow-ups?error=${encodeURIComponent(error.message)}`);
    return;
  }

  appRedirect(`/dashboard/follow-ups?message=Task%20marked%20${status}.`);
}

async function triggerReminderAutomationAction() {
  await requireActiveAgent();
  const dataClient = createDataClient();

  const { data: settings } = await dataClient
    .from("crm_settings")
    .select("reminder_email_enabled,company_name")
    .eq("id", true)
    .maybeSingle<{ reminder_email_enabled: boolean; company_name: string }>();

  if (!settings?.reminder_email_enabled) {
    appRedirect("/dashboard/follow-ups?message=Reminder%20emails%20are%20disabled%20in%20admin%20settings.");
    return;
  }

  const now = new Date();
  const next24h = new Date(now);
  next24h.setHours(next24h.getHours() + 24);

  const { data: tasks } = await dataClient
    .from("follow_up_tasks")
    .select("id,title,due_at,notes,lead_id,assigned_agent_id,status,reminder_enabled,reminder_sent_at")
    .eq("status", "pending")
    .eq("reminder_enabled", true)
    .is("reminder_sent_at", null)
    .lte("due_at", next24h.toISOString())
    .returns<FollowUpTask[]>();

  if (!tasks || tasks.length === 0) {
    appRedirect("/dashboard/follow-ups?message=No%20pending%20reminders.");
    return;
  }

  const leadIds = [...new Set(tasks.map((task) => task.lead_id))];
  const agentIds = [...new Set(tasks.map((task) => task.assigned_agent_id).filter(Boolean))] as string[];
  const [{ data: leads }, { data: agents }] = await Promise.all([
    dataClient.from("leads").select("id,full_name").in("id", leadIds),
    agentIds.length > 0
      ? dataClient.from("profiles").select("id,email").in("id", agentIds)
      : Promise.resolve({ data: [] as Array<{ id: string; email: string }> }),
  ]);
  const leadNameById = new Map((leads ?? []).map((lead) => [lead.id, lead.full_name]));
  const agentEmailById = new Map((agents ?? []).map((agent) => [agent.id, agent.email]));

  let sent = 0;
  for (const task of tasks) {
    const to = task.assigned_agent_id ? agentEmailById.get(task.assigned_agent_id) : null;
    if (!to) continue;
    const leadName = leadNameById.get(task.lead_id) ?? "Unknown lead";
    const dueAt = new Date(task.due_at).toLocaleString();
    const overdueLabel = new Date(task.due_at) < now ? "OVERDUE" : "Due soon";

    try {
      const result = await sendManualFollowUpEmail({
        to,
        taskId: task.id,
        title: task.title,
        leadName,
        dueAt,
        notes: task.notes ?? "-",
        overdueLabel,
        companyName: settings.company_name,
      });
      if (!result.sent) continue;

      await dataClient
        .from("follow_up_tasks")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", task.id);
      sent += 1;
    } catch {
      // Continue sending remaining reminders even if one fails.
    }
  }

  const fallbackMessage = `Reminder sync complete. Sent ${sent} of ${tasks.length}.`;
  appRedirect(`/dashboard/follow-ups?message=${encodeURIComponent(fallbackMessage)}`);
}

async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  appRedirect("/login");
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function MetricTile({ label, value, tone }: { label: string; value: number; tone: "amber" | "green" | "red" }) {
  const classes =
    tone === "amber"
      ? "bg-[#FFFBEB] text-[#92400E]"
      : tone === "green"
        ? "bg-[#ECFDF3] text-[#166534]"
        : "bg-[#FEF2F2] text-[#991B1B]";
  return (
    <div className="rounded-lg border border-[#EAE7E2] bg-white p-3">
      <p className="text-[11px] uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xl font-semibold ${classes}`}>{value}</p>
    </div>
  );
}

export default function AgentFollowUpsPage() {
  const [searchParams] = useSearchParams();
  const message = searchParams.get("message") ? decodeURIComponent(searchParams.get("message")!) : undefined;
  const error = searchParams.get("error") ? decodeURIComponent(searchParams.get("error")!) : undefined;
  const { data, loading, error: loadError, reload } = usePageLoader(loadFollowUpsPageData, []);

  if (loading) return <PageLoadingState />;
  if (loadError || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-red-600">
        {loadError ?? "Failed to load follow-ups."}
      </div>
    );
  }

  const {
    profile,
    myLeads,
    myActivities,
    unreadCount,
    leadNameById,
    pendingTasks,
    completedTasks,
    missedTasks,
    dueSoonTasks,
    overdueTasks,
    scheduledFutureTasks,
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
              className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]"
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
              className="block rounded-xl bg-[#E55B3C] px-3.5 py-3 text-base text-white"
            >
              Follow-ups
            </Link>
            <Link
              to="/dashboard/notifications"
              className="flex items-center justify-between rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]"
            >
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#E55B3C]/10 px-2 py-0.5 text-xs font-semibold text-[#E55B3C]">
                  {unreadCount}
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
          <div>
            <h1 className="text-3xl tracking-tight text-[#1A1A1A]">Follow-Up Execution</h1>
            <p className="text-sm text-gray-600">Log timeline entries, schedule next follow-up, and execute pending tasks.</p>
          </div>

          {message && <p className="text-sm text-green-700">{message}</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <MetricTile label="Pending Tasks" value={pendingTasks.length} tone="amber" />
            <MetricTile label="Completed Tasks" value={completedTasks.length} tone="green" />
            <MetricTile label="Missed Tasks" value={missedTasks.length} tone="red" />
            <MetricTile label="Future Scheduled" value={scheduledFutureTasks.length} tone="amber" />
          </div>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>In-App Reminder Feed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {dueSoonTasks.length === 0 && overdueTasks.length === 0 && (
                <p className="text-sm text-gray-500">No due-soon or overdue reminders right now.</p>
              )}
              {[...overdueTasks, ...dueSoonTasks].slice(0, 12).map((task) => (
                <div key={task.id} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
                  <p className="text-sm font-medium text-[#1A1A1A]">{task.title}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Lead: {leadNameById.get(task.lead_id) ?? "Unknown"} • Due: {new Date(task.due_at).toLocaleString()}
                  </p>
                  <p className={`mt-1 text-xs ${new Date(task.due_at) < now ? "text-red-700" : "text-amber-700"}`}>
                    {new Date(task.due_at) < now ? "Overdue" : "Due within 24h"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Upcoming Scheduled Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {scheduledFutureTasks.length === 0 && (
                <p className="text-sm text-gray-500">No future scheduled tasks yet.</p>
              )}
              {scheduledFutureTasks.slice(0, 20).map((task) => (
                <div key={task.id} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
                  <p className="text-sm font-medium text-[#1A1A1A]">{task.title}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Lead: {leadNameById.get(task.lead_id) ?? "Unknown"} • Due: {new Date(task.due_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Email Reminder Automation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-gray-600">
                Trigger reminder email run from the automation layer for due and overdue tasks.
              </p>
              <form action={triggerReminderAutomationAction}>
                <AdminFormSubmitButton
                  idleText="Run Reminder Sync Now"
                  pendingText="Running..."
                  className="h-10 rounded-lg bg-[#E55B3C] text-white hover:bg-[#c94b2f]"
                />
              </form>
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Log Lead Interaction</CardTitle>
              <p className="text-sm text-gray-500">
                Log a past call, message, or note to keep your lead's history up-to-date.
              </p>
            </CardHeader>
            <CardContent>
              <form action={createTimelineEntryAction} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Select Lead</label>
                  <SearchableLeadSelect name="lead_id" required leads={myLeads} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Interaction Type</label>
                  <select name="activity_type" defaultValue="note" className="h-10 w-full rounded-lg border border-[#CEC8BF] bg-white px-3 text-sm shadow-sm" required>
                    <option value="note">Note</option>
                    <option value="call">Call</option>
                    <option value="message">Message</option>
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Interaction Details</label>
                  <Input name="content" placeholder="Describe the interaction or leave a note..." className="h-10 rounded-lg w-full" required />
                </div>
                <div className="md:col-span-3 flex justify-end pt-2 border-t border-[#EAE7E2]">
                  <AdminFormSubmitButton
                    idleText="Log Interaction"
                    pendingText="Logging..."
                    className="h-10 rounded-lg bg-[#E55B3C] text-white hover:bg-[#c94b2f] px-6"
                  />
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Schedule Future Follow-up</CardTitle>
              <p className="text-sm text-gray-500">
                Set a reminder for your next step with a lead (e.g. call back tomorrow).
              </p>
            </CardHeader>
            <CardContent>
              <form action={createFollowUpTaskAction} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Select Lead</label>
                  <SearchableLeadSelect name="lead_id" required leads={myLeads} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Task Type</label>
                  <select name="task_type" defaultValue="follow_up" className="h-10 w-full rounded-lg border border-[#CEC8BF] bg-white px-3 text-sm shadow-sm">
                    <option value="follow_up">Follow-up</option>
                    <option value="call">Call</option>
                    <option value="message">Message</option>
                    <option value="meeting">Meeting</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Date & Time</label>
                  <Input id="next_follow_up_at" name="next_follow_up_at" type="datetime-local" className="h-10 w-full rounded-lg shadow-sm" required />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Task Title</label>
                  <Input name="title" placeholder="e.g. Call to discuss pricing" className="h-10 rounded-lg w-full" required />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Additional Notes</label>
                  <Input name="notes" placeholder="Any specific details..." className="h-10 rounded-lg w-full" />
                </div>
                <div className="lg:col-span-4 flex items-center justify-between pt-2 border-t border-[#EAE7E2]">
                  <label className="inline-flex items-center gap-2 text-sm text-[#1A1A1A] font-medium cursor-pointer">
                    <input name="reminder_enabled" type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-[#1A1A1A] focus:ring-[#1A1A1A]" />
                    Enable email reminder
                  </label>
                  <AdminFormSubmitButton
                    idleText="Schedule Task"
                    pendingText="Scheduling..."
                    className="h-10 rounded-lg bg-[#1A1A1A] text-white hover:bg-[#333333] px-6"
                  />
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-4">
            <Card className="border-[#E0DDD9] bg-white">
              <CardHeader>
                <CardTitle>Pending Follow-Up Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
                {pendingTasks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-[#CEC8BF] bg-[#FAF9F7] p-8 text-center">
                    <p className="text-sm text-gray-500">No pending tasks.</p>
                  </div>
                )}
                {pendingTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-[#EAE7E2] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="font-semibold text-[#1A1A1A]">{task.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Lead: <span className="font-medium text-[#1A1A1A]">{leadNameById.get(task.lead_id) ?? "Unknown"}</span>
                        </p>
                      </div>
                      {task.reminder_enabled && (
                        <span className="inline-flex shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-blue-700 uppercase border border-blue-100">
                          Reminder On
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium border ${new Date(task.due_at) < now ? "bg-red-50 text-red-700 border-red-100" : "bg-gray-50 text-gray-700 border-gray-200"}`}>
                        <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(task.due_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                        {new Date(task.due_at) < now && <span className="ml-1.5 font-bold">(Overdue)</span>}
                      </span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <form action={markTaskStatusAction} className="flex-1">
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="status" value="completed" />
                        <AdminFormSubmitButton
                          idleText="Complete"
                          pendingText="Saving..."
                          className="h-8 w-full text-xs bg-green-600 hover:bg-green-700 text-white rounded-md"
                        />
                      </form>
                      <form action={markTaskStatusAction} className="flex-1">
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="status" value="missed" />
                        <AdminFormSubmitButton
                          idleText="Missed"
                          pendingText="Saving..."
                          variant="outline"
                          className="h-8 w-full text-xs text-gray-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 rounded-md"
                        />
                      </form>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[#E0DDD9] bg-white">
              <CardHeader>
                <CardTitle>My Recent Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 max-h-[480px] overflow-y-auto pr-2 relative">
                {myActivities.length === 0 && (
                  <div className="rounded-lg border border-dashed border-[#CEC8BF] bg-[#FAF9F7] p-8 text-center mt-2">
                    <p className="text-sm text-gray-500">No timeline activities yet.</p>
                  </div>
                )}
                {myActivities.length > 0 && (
                  <div className="absolute left-[27px] top-4 bottom-4 w-px bg-gray-200 z-0 hidden sm:block"></div>
                )}
                <div className="space-y-4 relative z-10 pt-2">
                  {myActivities.map((activity) => {
                    const typeColors: Record<string, string> = {
                      note: "bg-gray-100 text-gray-700 border-gray-200",
                      call: "bg-green-100 text-green-700 border-green-200",
                      message: "bg-blue-100 text-blue-700 border-blue-200",
                    };
                    const typeColor = typeColors[activity.activity_type] || typeColors.note;

                    return (
                      <div key={activity.id} className="relative pl-0 sm:pl-10">
                        <div className={`hidden sm:flex absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-white ring-1 ring-gray-200 ${typeColor.split(" ")[0]}`}></div>
                        <div className="rounded-xl border border-[#EAE7E2] bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="font-semibold text-[#1A1A1A]">
                                {leadNameById.get(activity.lead_id) ?? "Unknown lead"}
                              </p>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {new Date(activity.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                              </p>
                            </div>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${typeColor}`}>
                              {activity.activity_type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed bg-[#FAF9F7] p-3 rounded-lg border border-[#EAE7E2]">
                            {activity.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
