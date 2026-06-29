"use client";

import { useSearchParams } from "react-router-dom";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";
import { requireAdmin } from "@/lib/auth/guards";
import type { FollowUpTask, Lead, LeadFollowUpActivity, Profile } from "@/lib/auth/types";
import { appRedirect } from "@/lib/navigation";
import { createDataClient } from "@/lib/supabase/client";

async function loadPageData() {
  await requireAdmin();
  const adminClient = createDataClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [leadsRes, agentsRes, activitiesRes, tasksRes] = await Promise.all([
    adminClient
      .from("leads")
      .select("id,full_name,email,phone,source,budget,location,area,status,assigned_agent_id,notes,custom_fields,created_by,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<Lead[]>(),
    adminClient
      .from("profiles")
      .select("id,email,role,status,is_primary_admin,created_at,updated_at")
      .eq("role", "agent")
      .in("status", ["active", "readonly"])
      .order("email", { ascending: true })
      .returns<Profile[]>(),
    adminClient
      .from("lead_follow_up_activities")
      .select("id,lead_id,actor_id,activity_type,content,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<LeadFollowUpActivity[]>(),
    adminClient
      .from("follow_up_tasks")
      .select("id,lead_id,assigned_agent_id,title,task_type,notes,scheduled_for,due_at,status,reminder_enabled,completed_at,reminder_sent_at,created_by,created_at,updated_at")
      .order("due_at", { ascending: true })
      .limit(120)
      .returns<FollowUpTask[]>(),
  ]);

  const leads = leadsRes.data ?? [];
  const agents = agentsRes.data ?? [];
  const activities = activitiesRes.data ?? [];
  const tasks = tasksRes.data ?? [];

  const leadMap = new Map(leads.map((lead) => [lead.id, lead]));
  const leadNameMap = new Map(leads.map((lead) => [lead.id, lead.full_name]));
  const agentEmailMap = new Map(agents.map((agent) => [agent.id, agent.email]));

  const overdueTasks = tasks.filter((task) => task.status === "pending" && new Date(task.due_at) < now);
  const todayTasks = tasks.filter((task) => {
    const due = new Date(task.due_at);
    return task.status === "pending" && due >= todayStart && due < todayEnd;
  });
  const futureScheduledTasks = tasks.filter(
    (task) => task.status === "pending" && new Date(task.due_at) >= todayEnd,
  );
  const missedTasks = tasks.filter((task) => task.status === "missed");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const reminderCandidates = tasks.filter(
    (task) => task.status === "pending" && !task.reminder_sent_at && new Date(task.due_at) <= todayEnd,
  );

  return {
    now,
    leads,
    agents,
    activities,
    leadMap,
    leadNameMap,
    agentEmailMap,
    overdueTasks,
    todayTasks,
    futureScheduledTasks,
    missedTasks,
    completedTasks,
    reminderCandidates,
  };
}

export default function AdminFollowUpsPage() {
  const [searchParams] = useSearchParams();
  const { data, loading, reload } = usePageLoader(() => loadPageData(), [searchParams.toString()]);

  async function createFollowUpActivityAction(formData: FormData) {
    const { profile } = await requireAdmin();
    const adminClient = createDataClient();

    const leadId = String(formData.get("lead_id") ?? "");
    const activityType = String(formData.get("activity_type") ?? "note");
    const content = String(formData.get("content") ?? "").trim();

    if (!leadId || !content) {
      appRedirect("/admin/follow-ups?error=Lead%20and%20content%20are%20required.");
      return;
    }

    const { error } = await adminClient.from("lead_follow_up_activities").insert({
      lead_id: leadId,
      actor_id: profile.id,
      activity_type: activityType,
      content,
    });

    if (error) {
      appRedirect(`/admin/follow-ups?error=${encodeURIComponent(error.message)}`);
      return;
    }

    reload();
    appRedirect("/admin/follow-ups?message=Follow-up%20entry%20added.");
  }

  async function createFollowUpTaskAction(formData: FormData) {
    const { profile } = await requireAdmin();
    const adminClient = createDataClient();

    const leadId = String(formData.get("lead_id") ?? "");
    const assignedAgentId = normalizeOptional(String(formData.get("assigned_agent_id") ?? ""));
    const taskType = String(formData.get("task_type") ?? "follow_up");
    const title = String(formData.get("title") ?? "").trim();
    const notes = normalizeOptional(String(formData.get("notes") ?? ""));
    const scheduledForRaw = String(formData.get("scheduled_for") ?? "");
    const dueAtRaw = String(formData.get("due_at") ?? "");

    if (!leadId || !assignedAgentId || !title || !scheduledForRaw || !dueAtRaw) {
      appRedirect("/admin/follow-ups?error=Lead,%20agent,%20title,%20schedule,%20and%20due%20time%20are%20required.");
      return;
    }

    const scheduledFor = new Date(scheduledForRaw);
    const dueAt = new Date(dueAtRaw);
    if (Number.isNaN(scheduledFor.getTime()) || Number.isNaN(dueAt.getTime())) {
      appRedirect("/admin/follow-ups?error=Invalid%20schedule%20or%20due%20date.");
      return;
    }

    if (dueAt < scheduledFor) {
      appRedirect("/admin/follow-ups?error=Due%20time%20must%20be%20after%20scheduled%20time.");
      return;
    }

    const { error } = await adminClient.from("follow_up_tasks").insert({
      lead_id: leadId,
      assigned_agent_id: assignedAgentId,
      task_type: taskType,
      title,
      notes,
      scheduled_for: scheduledFor.toISOString(),
      due_at: dueAt.toISOString(),
      status: "pending",
      created_by: profile.id,
    });

    if (error) {
      appRedirect(`/admin/follow-ups?error=${encodeURIComponent(error.message)}`);
      return;
    }

    reload();
    appRedirect("/admin/follow-ups?message=Follow-up%20task%20scheduled.");
  }

  async function markTaskCompletedAction(formData: FormData) {
    await requireAdmin();
    const adminClient = createDataClient();
    const taskId = String(formData.get("task_id") ?? "");

    const { error } = await adminClient
      .from("follow_up_tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId);

    if (error) {
      appRedirect(`/admin/follow-ups?error=${encodeURIComponent(error.message)}`);
      return;
    }

    reload();
    appRedirect("/admin/follow-ups?message=Task%20marked%20completed.");
  }

  async function markTaskMissedAction(formData: FormData) {
    await requireAdmin();
    const adminClient = createDataClient();
    const taskId = String(formData.get("task_id") ?? "");

    const { error } = await adminClient
      .from("follow_up_tasks")
      .update({ status: "missed" })
      .eq("id", taskId);

    if (error) {
      appRedirect(`/admin/follow-ups?error=${encodeURIComponent(error.message)}`);
      return;
    }

    reload();
    appRedirect("/admin/follow-ups?message=Task%20marked%20missed.");
  }

  async function markReminderSentAction(formData: FormData) {
    await requireAdmin();
    const adminClient = createDataClient();
    const taskId = String(formData.get("task_id") ?? "");

    const { error } = await adminClient
      .from("follow_up_tasks")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", taskId);

    if (error) {
      appRedirect(`/admin/follow-ups?error=${encodeURIComponent(error.message)}`);
      return;
    }

    reload();
    appRedirect("/admin/follow-ups?message=Reminder%20marked%20as%20sent.");
  }

  if (loading || !data) return <PageLoadingState />;

  const {
    now,
    leads,
    agents,
    activities,
    leadMap,
    leadNameMap,
    agentEmailMap,
    overdueTasks,
    todayTasks,
    futureScheduledTasks,
    missedTasks,
    completedTasks,
    reminderCandidates,
  } = data;

  const message = searchParams.get("message") ? decodeURIComponent(searchParams.get("message")!) : undefined;
  const error = searchParams.get("error") ? decodeURIComponent(searchParams.get("error")!) : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl tracking-tight text-[#1A1A1A]">Follow-Up and Tasking</h1>
        <p className="text-sm text-gray-600">
          Follow-up timeline, future scheduling, daily reminders, overdue alerts, and missed follow-up tracking.
        </p>
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
        <MetricCard title="Pending Today" value={String(todayTasks.length)} tone="amber" />
        <MetricCard title="Overdue" value={String(overdueTasks.length)} tone="red" />
        <MetricCard title="Future Scheduled" value={String(futureScheduledTasks.length)} tone="blue" />
        <MetricCard title="Missed" value={String(missedTasks.length)} tone="gray" />
        <MetricCard title="Reminder Due" value={String(reminderCandidates.length)} tone="blue" />
        <MetricCard title="Completed" value={String(completedTasks.length)} tone="green" />
      </div>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Add Follow-Up Timeline Entry</CardTitle>
          <p className="text-sm text-gray-600">
            For admins to log lead interactions (note/call/message) so both admin and assigned agent can track complete follow-up history.
          </p>
        </CardHeader>
        <CardContent>
          <form action={createFollowUpActivityAction} className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <select name="lead_id" className="h-10 rounded-lg border border-[#CEC8BF] bg-white px-3 text-sm" required>
              <option value="">Select lead...</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.full_name}
                </option>
              ))}
            </select>
            <select
              name="activity_type"
              className="h-10 rounded-lg border border-[#CEC8BF] bg-white px-3 text-sm"
              required
              defaultValue="note"
            >
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="message">Message</option>
            </select>
            <Input name="content" className="h-10 rounded-lg md:col-span-2" placeholder="Write call note/message summary..." required />
            <AdminFormSubmitButton
              idleText="Add Entry"
              pendingText="Adding..."
              className="h-10 rounded-lg bg-[#E55B3C] hover:bg-[#c94b2f] md:col-span-1"
            />
          </form>
        </CardContent>
      </Card>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Future Task Scheduling</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createFollowUpTaskAction} className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <select name="lead_id" className="h-10 rounded-lg border border-[#CEC8BF] bg-white px-3 text-sm" required>
              <option value="">Select lead...</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.full_name}
                </option>
              ))}
            </select>
            <select name="assigned_agent_id" className="h-10 rounded-lg border border-[#CEC8BF] bg-white px-3 text-sm" required>
              <option value="">Assign to agent...</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.email}
                </option>
              ))}
            </select>
            <select name="task_type" defaultValue="follow_up" className="h-10 rounded-lg border border-[#CEC8BF] bg-white px-3 text-sm">
              <option value="follow_up">Follow-up</option>
              <option value="call">Call</option>
              <option value="message">Message</option>
              <option value="meeting">Meeting</option>
            </select>
            <Input name="title" className="h-10 rounded-lg" placeholder="Task title" required />
            <Input name="scheduled_for" type="datetime-local" className="h-10 rounded-lg" required />
            <Input name="due_at" type="datetime-local" className="h-10 rounded-lg" required />
            <Input name="notes" className="h-10 rounded-lg md:col-span-2" placeholder="Notes (optional)" />
            <AdminFormSubmitButton
              idleText="Schedule Task"
              pendingText="Scheduling..."
              className="h-10 rounded-lg bg-[#E55B3C] hover:bg-[#c94b2f]"
            />
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card className="border-[#E0DDD9] bg-white">
          <CardHeader>
            <CardTitle>Follow-Up Timeline (Notes / Calls / Messages)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
            {activities.length === 0 && <p className="text-sm text-gray-500">No follow-up activities yet.</p>}
            {activities.map((activity) => (
              <div key={activity.id} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
                <p className="text-sm text-[#1A1A1A]">
                  <span className="font-semibold">{leadNameMap.get(activity.lead_id) ?? "Unknown lead"}</span>
                  <span className="ml-2 inline-flex rounded-full bg-[#EFEAE2] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[#5F5648]">
                    {activity.activity_type}
                  </span>
                </p>
                <p className="mt-1 text-sm text-gray-700">{activity.content}</p>
                <p className="mt-1 text-xs text-gray-500">{new Date(activity.created_at).toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#E0DDD9] bg-white">
          <CardHeader>
            <CardTitle>Daily Reminders + Overdue Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
            {overdueTasks.length === 0 && todayTasks.length === 0 && (
              <p className="text-sm text-gray-500">No due or overdue tasks for today.</p>
            )}
            {[...overdueTasks, ...todayTasks].map((task) => (
              <div key={task.id} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
                <p className="text-sm text-[#1A1A1A]">
                  <span className="font-medium">{task.title}</span>
                  <span
                    className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      new Date(task.due_at) < now ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#FEF3C7] text-[#92400E]"
                    }`}
                  >
                    {new Date(task.due_at) < now ? "Overdue" : "Due Today"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Lead: {leadNameMap.get(task.lead_id) ?? "Unknown"} • Agent:{" "}
                  {task.assigned_agent_id ? (agentEmailMap.get(task.assigned_agent_id) ?? "Unknown") : "Unassigned"} • Due:{" "}
                  {new Date(task.due_at).toLocaleString()}
                </p>
                <div className="mt-2 flex gap-2">
                  <form action={markTaskCompletedAction}>
                    <input type="hidden" name="task_id" value={task.id} />
                    <AdminFormSubmitButton
                      idleText="Mark Completed"
                      pendingText="Saving..."
                      variant="outline"
                      className="h-8 text-xs"
                    />
                  </form>
                  <form action={markReminderSentAction}>
                    <input type="hidden" name="task_id" value={task.id} />
                    <AdminFormSubmitButton
                      idleText="Mark Reminder Sent"
                      pendingText="Saving..."
                      variant="outline"
                      className="h-8 text-xs"
                    />
                  </form>
                  <form action={markTaskMissedAction}>
                    <input type="hidden" name="task_id" value={task.id} />
                    <AdminFormSubmitButton
                      idleText="Mark Missed"
                      pendingText="Saving..."
                      variant="outline"
                      className="h-8 text-xs"
                    />
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Missed Follow-Up Tracking Panel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {missedTasks.length === 0 && <p className="text-sm text-gray-500">No missed follow-ups yet.</p>}
          {missedTasks.map((task) => (
            <div key={task.id} className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3">
              <p className="text-sm font-medium text-[#7F1D1D]">{task.title}</p>
              <p className="mt-1 text-xs text-[#991B1B]">
                Lead: {leadMap.get(task.lead_id)?.full_name ?? "Unknown"} • Due: {new Date(task.due_at).toLocaleString()} • Agent:{" "}
                {task.assigned_agent_id ? (agentEmailMap.get(task.assigned_agent_id) ?? "Unknown") : "Unassigned"}
              </p>
              <div className="mt-2">
                <form action={markTaskCompletedAction}>
                  <input type="hidden" name="task_id" value={task.id} />
                  <AdminFormSubmitButton
                    idleText="Recover as Completed"
                    pendingText="Saving..."
                    className="h-8 bg-[#E55B3C] hover:bg-[#c94b2f] text-xs"
                  />
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Upcoming Scheduled Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {futureScheduledTasks.length === 0 && (
            <p className="text-sm text-gray-500">No future scheduled tasks yet.</p>
          )}
          {futureScheduledTasks.map((task) => (
            <div key={task.id} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
              <p className="text-sm font-medium text-[#1A1A1A]">{task.title}</p>
              <p className="mt-1 text-xs text-gray-600">
                Lead: {leadNameMap.get(task.lead_id) ?? "Unknown"} • Agent:{" "}
                {task.assigned_agent_id ? (agentEmailMap.get(task.assigned_agent_id) ?? "Unknown") : "Unassigned"} • Due:{" "}
                {new Date(task.due_at).toLocaleString()}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, tone }: { title: string; value: string; tone: "amber" | "red" | "gray" | "blue" | "green" }) {
  const classes =
    tone === "red"
      ? "bg-[#FEF2F2] text-[#991B1B]"
      : tone === "amber"
        ? "bg-[#FFFBEB] text-[#92400E]"
        : tone === "blue"
          ? "bg-[#EFF6FF] text-[#1D4ED8]"
          : tone === "green"
            ? "bg-[#ECFDF3] text-[#166534]"
            : "bg-[#F3F4F6] text-[#374151]";
  return (
    <Card className="border-[#E0DDD9] bg-white">
      <CardContent className="pt-4">
        <p className="text-[11px] uppercase tracking-wider text-gray-500">{title}</p>
        <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xl font-semibold ${classes}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
