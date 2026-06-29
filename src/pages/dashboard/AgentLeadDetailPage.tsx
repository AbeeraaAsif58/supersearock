"use client";

import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { requireActiveAgent, requireAgent } from "@/lib/auth/guards";
import type { LeadStatus, Profile } from "@/lib/auth/types";
import { createDataClient, createClient } from "@/lib/supabase/client";
import { appRedirect } from "@/lib/navigation";
import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";

const leadStatuses: LeadStatus[] = ["new", "assigned", "follow_up", "interested", "call_denied", "closed", "lost"];

type LeadDetailData = {
  profile: Profile;
  lead: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    source: string;
    budget: number | null;
    location: string | null;
    area: string | null;
    status: LeadStatus;
    assigned_agent_id: string | null;
    notes: string | null;
    custom_fields: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
  tasks: Array<{
    id: string;
    title: string;
    due_at: string;
    status: string;
    task_type: string;
    notes: string | null;
  }>;
  activities: Array<{
    id: string;
    activity_type: string;
    content: string;
    created_at: string;
  }>;
  logs: Array<{
    id: string;
    previous_status: LeadStatus;
    new_status: LeadStatus;
    change_note: string | null;
    created_at: string;
  }>;
  unreadNotificationCount: number;
  allowedTargets: LeadStatus[];
  returnQuery: string;
  returnUrl: string;
};

async function loadLeadDetailData(leadId: string, returnQuery: string): Promise<LeadDetailData> {
  const { profile } = await requireAgent();
  const dataClient = createDataClient();
  const returnUrl = `/dashboard/leads${returnQuery ? `?${returnQuery}` : ""}`;

  const [{ data: lead }, { data: tasks }, { data: activities }, { data: logs }, { count: unreadCount = 0 }] =
    await Promise.all([
      dataClient
        .from("leads")
        .select("id,full_name,email,phone,source,budget,location,area,status,assigned_agent_id,notes,custom_fields,created_at,updated_at")
        .eq("id", leadId)
        .eq("assigned_agent_id", profile.id)
        .maybeSingle<LeadDetailData["lead"]>(),
      dataClient
        .from("follow_up_tasks")
        .select("id,title,due_at,status,task_type,notes")
        .eq("lead_id", leadId)
        .eq("assigned_agent_id", profile.id)
        .order("due_at", { ascending: false })
        .limit(50),
      dataClient
        .from("lead_follow_up_activities")
        .select("id,activity_type,content,created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(50),
      dataClient
        .from("lead_status_change_logs")
        .select("id,previous_status,new_status,change_note,created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(50),
      dataClient
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("is_read", false),
    ]);

  if (!lead) {
    appRedirect(`${returnUrl}${returnQuery ? "&" : "?"}error=Lead%20not%20accessible.`);
    throw new Error("Lead not accessible");
  }

  return {
    profile,
    lead,
    tasks: (tasks ?? []) as LeadDetailData["tasks"],
    activities: (activities ?? []) as LeadDetailData["activities"],
    logs: (logs ?? []) as LeadDetailData["logs"],
    unreadNotificationCount: unreadCount ?? 0,
    allowedTargets: getAllowedStatusTargets(lead.status),
    returnQuery,
    returnUrl,
  };
}

async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  appRedirect("/login");
}

async function updateLeadStatusFromDetailAction(formData: FormData) {
  const { profile } = await requireActiveAgent();
  const dataClient = createDataClient();

  const leadId = String(formData.get("lead_id") ?? "");
  const targetStatus = String(formData.get("target_status") ?? "") as LeadStatus;
  const transitionNote = normalizeOptional(String(formData.get("transition_note") ?? ""));
  const returnQuery = String(formData.get("return_query") ?? "");
  const detailPath = `/dashboard/leads/${leadId}`;
  const returnParam = returnQuery ? `return=${encodeURIComponent(returnQuery)}` : "";
  const base = `${detailPath}${returnParam ? `?${returnParam}` : ""}`;

  if (!leadId || !leadStatuses.includes(targetStatus)) {
    appRedirect(`${base}${returnParam ? "&" : "?"}error=Invalid%20lead%20status%20update.`);
    return;
  }

  const { data: lead } = await dataClient
    .from("leads")
    .select("id,status,assigned_agent_id")
    .eq("id", leadId)
    .eq("assigned_agent_id", profile.id)
    .maybeSingle<{ id: string; status: LeadStatus; assigned_agent_id: string }>();

  if (!lead) {
    appRedirect(`${base}${returnParam ? "&" : "?"}error=Lead%20not%20accessible.`);
    return;
  }
  if (targetStatus === lead.status) {
    appRedirect(`${base}${returnParam ? "&" : "?"}error=Select%20a%20different%20status.`);
    return;
  }
  const allowedTargets = getAllowedStatusTargets(lead.status);
  if (!allowedTargets.includes(targetStatus)) {
    appRedirect(`${base}${returnParam ? "&" : "?"}error=Status%20transition%20not%20allowed.`);
    return;
  }

  const { error } = await dataClient
    .from("leads")
    .update({ status: targetStatus })
    .eq("id", leadId)
    .eq("assigned_agent_id", profile.id);

  if (error) {
    appRedirect(`${base}${returnParam ? "&" : "?"}error=${encodeURIComponent(error.message)}`);
    return;
  }

  await dataClient.from("lead_status_change_logs").insert({
    lead_id: leadId,
    previous_status: lead.status,
    new_status: targetStatus,
    changed_by: profile.id,
    change_note: transitionNote,
  });

  appRedirect(`${base}${returnParam ? "&" : "?"}message=Lead%20status%20updated.`);
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
      <p className="text-[11px] uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#1A1A1A] break-words">{value}</p>
    </div>
  );
}

function getAllowedStatusTargets(status: LeadStatus): LeadStatus[] {
  return leadStatuses.filter((s) => s !== status);
}

export default function AgentLeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const [searchParams] = useSearchParams();
  const returnQuery = searchParams.get("return") ?? "";
  const message = searchParams.get("message") ? decodeURIComponent(searchParams.get("message")!) : undefined;
  const error = searchParams.get("error") ? decodeURIComponent(searchParams.get("error")!) : undefined;
  const searchKey = searchParams.toString();

  const { data, loading, error: loadError } = usePageLoader(
    () => loadLeadDetailData(leadId ?? "", returnQuery),
    [leadId, searchKey],
  );

  if (loading) return <PageLoadingState />;
  if (loadError || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-red-600">
        {loadError ?? "Failed to load lead."}
      </div>
    );
  }

  const { profile, lead, tasks, activities, logs, unreadNotificationCount, allowedTargets, returnUrl } = data;

  return (
    <main className="min-h-screen bg-[#F4F1ED] p-2 md:p-3">
      <div className="mx-auto grid w-full max-w-[98vw] grid-cols-1 gap-3 lg:grid-cols-[300px_1fr]">
        <aside className="sticky top-2 md:top-3 h-[calc(100vh-1rem)] md:h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl border border-[#E0DDD9] bg-white/70 p-5 md:p-6">
          <div className="border-b border-[#EAE7E2] pb-4">
            <p className="text-xs uppercase tracking-[0.25em] text-[#E55B3C]">Super Sea Rock Real Estate</p>
            <h2 className="mt-2 text-xl tracking-tight text-[#1A1A1A]">Agent Workspace</h2>
          </div>

          <nav className="mt-5 space-y-1.5">
            <Link to="/dashboard" className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]">
              Dashboard
            </Link>
            <Link to="/dashboard/leads" className="block rounded-xl bg-[#E55B3C] px-3.5 py-3 text-base text-white">
              My Leads
            </Link>
            <Link to="/dashboard/follow-ups" className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]">
              Follow-ups
            </Link>
            <Link
              to="/dashboard/notifications"
              className="flex items-center justify-between rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]"
            >
              <span>Notifications</span>
              {unreadNotificationCount > 0 && (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#E55B3C]/10 px-2 py-0.5 text-xs font-semibold text-[#E55B3C]">
                  {unreadNotificationCount}
                </span>
              )}
            </Link>
            <Link to="/dashboard/settings" className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]">
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

        <section className="min-w-0 space-y-3">
          <Card className="border-[#E0DDD9] bg-white/70">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Lead Management</CardTitle>
                <p className="text-sm text-gray-600 mt-1">{lead.full_name}</p>
              </div>
              <Link
                to={returnUrl}
                className="inline-flex h-9 items-center rounded-md border border-[#E0DDD9] px-3 text-sm text-[#1A1A1A] hover:bg-[#F4F1ED]"
              >
                Back to Leads
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {message && <p className="text-sm text-green-700">{message}</p>}
              {error && <p className="text-sm text-red-700">{error}</p>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-sm">
                <Info label="Status" value={lead.status.replace("_", " ")} />
                <Info label="Source" value={lead.source} />
                <Info label="Area" value={lead.area ?? "-"} />
                <Info label="Email" value={lead.email ?? "-"} />
                <Info label="Phone" value={lead.phone ?? "-"} />
                <Info label="Budget" value={lead.budget?.toString() ?? "-"} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Update Lead Status</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateLeadStatusFromDetailAction} className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <input type="hidden" name="lead_id" value={lead.id} />
                <input type="hidden" name="return_query" value={returnQuery} />
                <select
                  name="target_status"
                  defaultValue={allowedTargets[0] ?? lead.status}
                  className="h-10 rounded-lg border border-[#CEC8BF] px-3 text-sm bg-white"
                  disabled={allowedTargets.length === 0}
                >
                  {allowedTargets.length === 0 ? (
                    <option value={lead.status}>{lead.status.replace("_", " ")}</option>
                  ) : (
                    allowedTargets.map((status) => (
                      <option key={status} value={status}>
                        {status.replace("_", " ")}
                      </option>
                    ))
                  )}
                </select>
                <Input name="transition_note" placeholder="Transition note" className="h-10 rounded-lg md:col-span-2" />
                {allowedTargets.length === 0 ? (
                  <p className="text-xs text-gray-500">This lead is in a terminal status and cannot be moved further.</p>
                ) : (
                  <AdminFormSubmitButton
                    idleText="Update status"
                    pendingText="Updating..."
                    className="h-10 rounded-lg bg-[#E55B3C] text-white hover:bg-[#c94b2f]"
                  />
                )}
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <Card className="border-[#E0DDD9] bg-white">
              <CardHeader>
                <CardTitle>Follow-up Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {tasks.length === 0 && <p className="text-sm text-gray-500">No tasks for this lead.</p>}
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3 text-sm">
                    <p className="font-medium text-[#1A1A1A]">{task.title}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      {task.task_type} • {task.status} • Due {new Date(task.due_at).toLocaleString()}
                    </p>
                    {task.notes && <p className="mt-1 text-xs text-gray-600">{task.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[#E0DDD9] bg-white">
              <CardHeader>
                <CardTitle>Timeline & Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {activities.length === 0 && <p className="text-sm text-gray-500">No timeline entries yet.</p>}
                {activities.map((activity) => (
                  <div key={activity.id} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3 text-sm">
                    <p className="font-medium text-[#1A1A1A]">{activity.activity_type}</p>
                    <p className="mt-1 text-gray-700">{activity.content}</p>
                    <p className="mt-1 text-xs text-gray-500">{new Date(activity.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Status History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {logs.length === 0 && <p className="text-sm text-gray-500">No status changes yet.</p>}
              {logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3 text-sm">
                  <p className="text-[#1A1A1A]">
                    {String(log.previous_status).replace("_", " ")} {"->"} {String(log.new_status).replace("_", " ")}
                  </p>
                  {log.change_note && <p className="mt-1 text-xs text-gray-600">{log.change_note}</p>}
                  <p className="mt-1 text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
