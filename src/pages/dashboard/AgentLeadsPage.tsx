"use client";

import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAgent } from "@/lib/auth/guards";
import type { Lead, LeadStatus, Profile } from "@/lib/auth/types";
import { AgentRealtimeRefresh } from "@/components/agent/agent-realtime-refresh";
import { createDataClient, createClient } from "@/lib/supabase/client";
import { appRedirect } from "@/lib/navigation";
import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";

const leadStatuses: LeadStatus[] = [
  "new",
  "assigned",
  "follow_up",
  "interested",
  "call_denied",
  "closed",
  "lost",
];

type LeadsPageData = {
  profile: Profile;
  myLeads: Lead[];
  unreadCount: number;
  statusCountMap: Record<LeadStatus, number>;
  filterStatus: string;
  filterSource: string;
  filterArea: string;
  budgetMin: string;
  budgetMax: string;
  q: string;
  returnQuery: string;
  selectedLead: Lead | null;
  selectedLeadStatusLogs: Array<{
    id: string;
    previous_status: LeadStatus;
    new_status: LeadStatus;
    change_note: string | null;
    changed_by: string;
    created_at: string;
  }>;
  leadSlaBreached: Map<string, boolean>;
};

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, "\\$&");
}

function buildQuery(params: Record<string, string>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim().length > 0) {
      searchParams.set(key, value);
    }
  });
  return searchParams.toString();
}

async function loadLeadsPageData(searchKey: string): Promise<LeadsPageData> {
  const params = new URLSearchParams(searchKey);
  const { profile } = await requireAgent();
  const dataClient = createDataClient();

  const filterStatus =
    params.get("status") && [...leadStatuses, "all"].includes(params.get("status")!)
      ? params.get("status")!
      : "all";
  const filterSource = params.get("source")?.trim() ?? "";
  const filterArea = params.get("area")?.trim() ?? "";
  const budgetMin = params.get("budget_min") ?? "";
  const budgetMax = params.get("budget_max") ?? "";
  const q = params.get("q")?.trim() ?? "";
  const selectedLeadId = params.get("lead_id") ?? "";

  let leadsQuery = dataClient
    .from("leads")
    .select("id,full_name,email,phone,source,budget,location,area,status,assigned_agent_id,notes,custom_fields,created_by,created_at,updated_at")
    .eq("assigned_agent_id", profile.id)
    .order("updated_at", { ascending: false });

  if (filterStatus !== "all") leadsQuery = leadsQuery.eq("status", filterStatus);
  if (filterSource) leadsQuery = leadsQuery.ilike("source", `%${filterSource}%`);
  if (filterArea) leadsQuery = leadsQuery.ilike("area", `%${filterArea}%`);
  if (budgetMin) leadsQuery = leadsQuery.gte("budget", Number(budgetMin));
  if (budgetMax) leadsQuery = leadsQuery.lte("budget", Number(budgetMax));
  if (q) {
    leadsQuery = leadsQuery.or(
      `full_name.ilike.%${escapeIlike(q)}%,email.ilike.%${escapeIlike(q)}%,phone.ilike.%${escapeIlike(q)}%`,
    );
  }

  const [{ data: leads }, { data: settings }, { data: pendingTasks }, { count: unreadNotificationsCount = 0 }] =
    await Promise.all([
      leadsQuery.returns<Lead[]>(),
      dataClient
        .from("crm_settings")
        .select("mandatory_transition_notes,close_lost_requires_activity,sla_follow_up_delay_hours")
        .eq("id", true)
        .maybeSingle<{
          mandatory_transition_notes: boolean;
          close_lost_requires_activity: boolean;
          sla_follow_up_delay_hours: number;
        }>(),
      dataClient
        .from("follow_up_tasks")
        .select("id,lead_id,due_at,status")
        .eq("assigned_agent_id", profile.id)
        .eq("status", "pending")
        .returns<Array<{ id: string; lead_id: string; due_at: string; status: string }>>(),
      dataClient
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("is_read", false),
    ]);

  const myLeads = leads ?? [];
  const qualitySettings = {
    mandatory_transition_notes: settings?.mandatory_transition_notes ?? true,
    close_lost_requires_activity: settings?.close_lost_requires_activity ?? true,
    sla_follow_up_delay_hours: settings?.sla_follow_up_delay_hours ?? 24,
  };
  const now = new Date();
  const slaThresholdMs = qualitySettings.sla_follow_up_delay_hours * 60 * 60 * 1000;
  const pendingByLead = new Map<string, Array<{ id: string; lead_id: string; due_at: string; status: string }>>();
  for (const task of pendingTasks ?? []) {
    const list = pendingByLead.get(task.lead_id) ?? [];
    list.push(task);
    pendingByLead.set(task.lead_id, list);
  }
  const leadSlaBreached = new Map<string, boolean>();
  for (const lead of myLeads) {
    const tasksForLead = pendingByLead.get(lead.id) ?? [];
    const breached = tasksForLead.some((task) => now.getTime() - new Date(task.due_at).getTime() > slaThresholdMs);
    leadSlaBreached.set(lead.id, breached);
  }

  let selectedLead: Lead | null = null;
  let selectedLeadStatusLogs: LeadsPageData["selectedLeadStatusLogs"] = [];
  if (selectedLeadId) {
    const [{ data: leadData }, { data: statusLogs }] = await Promise.all([
      dataClient
        .from("leads")
        .select("id,full_name,email,phone,source,budget,location,area,status,assigned_agent_id,notes,custom_fields,created_by,created_at,updated_at")
        .eq("id", selectedLeadId)
        .eq("assigned_agent_id", profile.id)
        .maybeSingle<Lead>(),
      dataClient
        .from("lead_status_change_logs")
        .select("id,previous_status,new_status,change_note,changed_by,created_at")
        .eq("lead_id", selectedLeadId)
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<LeadsPageData["selectedLeadStatusLogs"]>(),
    ]);
    selectedLead = leadData ?? null;
    selectedLeadStatusLogs = statusLogs ?? [];
  }

  const returnQuery = buildQuery({
    status: filterStatus,
    source: filterSource,
    area: filterArea,
    budget_min: budgetMin,
    budget_max: budgetMax,
    q,
  });

  const statusCountMap = Object.fromEntries(leadStatuses.map((status) => [status, 0])) as Record<LeadStatus, number>;
  for (const lead of myLeads) {
    statusCountMap[lead.status] += 1;
  }

  return {
    profile,
    myLeads,
    unreadCount: unreadNotificationsCount ?? 0,
    statusCountMap,
    filterStatus,
    filterSource,
    filterArea,
    budgetMin,
    budgetMax,
    q,
    returnQuery,
    selectedLead,
    selectedLeadStatusLogs,
    leadSlaBreached,
  };
}

async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  appRedirect("/login");
}

function formatCustomFieldLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function getStatusClasses(status: LeadStatus) {
  switch (status) {
    case "new":
      return "bg-blue-50 text-blue-700";
    case "assigned":
      return "bg-indigo-50 text-indigo-700";
    case "follow_up":
      return "bg-amber-50 text-amber-700";
    case "interested":
      return "bg-emerald-50 text-emerald-700";
    case "call_denied":
      return "bg-orange-50 text-orange-700";
    case "closed":
      return "bg-green-100 text-green-700";
    case "lost":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function SimpleDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-[#1A1A1A] break-words">{value}</dd>
    </div>
  );
}

export default function AgentLeadsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchKey = searchParams.toString();
  const message = searchParams.get("message") ? decodeURIComponent(searchParams.get("message")!) : undefined;
  const error = searchParams.get("error") ? decodeURIComponent(searchParams.get("error")!) : undefined;
  const { data, loading, error: loadError, reload } = usePageLoader(
    () => loadLeadsPageData(searchKey),
    [searchKey],
  );

  if (loading) return <PageLoadingState />;
  if (loadError || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-red-600">
        {loadError ?? "Failed to load leads."}
      </div>
    );
  }

  const {
    profile,
    myLeads,
    unreadCount,
    statusCountMap,
    filterStatus,
    filterSource,
    filterArea,
    budgetMin,
    budgetMax,
    q,
    returnQuery,
    selectedLead,
    selectedLeadStatusLogs,
    leadSlaBreached,
  } = data;

  const handleFilterSubmit = (formData: FormData) => {
    const params = new URLSearchParams();
    const fields = ["q", "status", "source", "area", "budget_min", "budget_max"] as const;
    for (const field of fields) {
      const value = String(formData.get(field) ?? "").trim();
      if (value) params.set(field, value);
    }
    navigate(`/dashboard/leads?${params.toString()}`);
  };

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
              className="block rounded-xl bg-[#E55B3C] px-3.5 py-3 text-base text-white"
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

        <section className="min-w-0 rounded-2xl border border-[#E0DDD9] bg-white/70 p-5 md:p-7 space-y-4">
          <div>
            <h1 className="text-3xl tracking-tight text-[#1A1A1A]">My Assigned Leads</h1>
            <p className="text-sm text-gray-600">Manage your assigned leads and move them through the pipeline.</p>
            {message && <p className="mt-1 text-sm text-green-700">{message}</p>}
            {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {leadStatuses.map((status) => (
              <div key={status} className="rounded-lg border border-[#EAE7E2] bg-white p-3">
                <p className="text-[11px] uppercase tracking-widest text-gray-500">{status.replace("_", " ")}</p>
                <p className="mt-1 text-xl font-semibold text-[#1A1A1A]">{statusCountMap[status]}</p>
              </div>
            ))}
          </div>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                <Input name="q" defaultValue={q} placeholder="Search name/email/phone" className="h-10 rounded-lg" />
                <select name="status" defaultValue={filterStatus} className="h-10 rounded-lg border border-[#CEC8BF] px-3 text-sm bg-white">
                  <option value="all">all status</option>
                  {leadStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <Input name="source" defaultValue={filterSource} placeholder="Source" className="h-10 rounded-lg" />
                <Input name="area" defaultValue={filterArea} placeholder="Area" className="h-10 rounded-lg" />
                <Input name="budget_min" type="number" step="0.01" defaultValue={budgetMin} placeholder="Budget min" className="h-10 rounded-lg" />
                <Input name="budget_max" type="number" step="0.01" defaultValue={budgetMax} placeholder="Budget max" className="h-10 rounded-lg" />
                <AdminFormSubmitButton
                  idleText="Apply filters"
                  pendingText="Applying..."
                  className="h-10 rounded-lg bg-[#E55B3C] text-white hover:bg-[#c94b2f]"
                />
              </form>
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>My Leads List</CardTitle>
            </CardHeader>
            <CardContent>
              {myLeads.length === 0 && <p className="text-sm text-gray-500">No assigned leads found.</p>}
              {myLeads.length > 0 && (
                <div className="max-w-full overflow-x-auto rounded-lg border border-[#EAE7E2]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#FAF9F7]">
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>SLA</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myLeads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.full_name}</TableCell>
                          <TableCell className="text-xs text-gray-600">
                            {lead.email ?? "no-email"}
                            <br />
                            {lead.phone ?? "no-phone"}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusClasses(lead.status)}`}>
                              {lead.status.replace("_", " ")}
                            </span>
                          </TableCell>
                          <TableCell>{lead.source}</TableCell>
                          <TableCell>{lead.area ?? "-"}</TableCell>
                          <TableCell>{lead.budget ?? "-"}</TableCell>
                          <TableCell>
                            {leadSlaBreached.get(lead.id) ? (
                              <span className="inline-flex rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-semibold text-[#991B1B]">
                                SLA Breached
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-semibold text-[#166534]">
                                On Track
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-1 items-center">
                              <Link
                                to={`/dashboard/leads/${lead.id}?return=${encodeURIComponent(returnQuery)}`}
                                className="inline-flex h-8 items-center rounded-md border border-[#E0DDD9] px-3 text-xs font-medium text-[#1A1A1A] hover:bg-[#F4F1ED]"
                              >
                                Manage
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-[#E0DDD9] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EAE7E2] px-5 py-4">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-[#1A1A1A]">Lead Details</h3>
                <p className="text-sm text-gray-500">{selectedLead.full_name}</p>
              </div>
              <Link
                to={`/dashboard/leads${returnQuery ? `?${returnQuery}` : ""}`}
                className="rounded-md border border-[#E0DDD9] px-3 py-1.5 text-sm text-[#1A1A1A] hover:bg-[#F4F1ED]"
              >
                Close
              </Link>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              <dl className="grid grid-cols-1 gap-y-3 text-sm md:grid-cols-2 md:gap-x-8">
                <SimpleDetailItem label="Full Name" value={selectedLead.full_name} />
                <SimpleDetailItem label="Email" value={selectedLead.email ?? "-"} />
                <SimpleDetailItem label="Phone" value={selectedLead.phone ?? "-"} />
                <SimpleDetailItem label="Status" value={selectedLead.status.replace("_", " ")} />
                <SimpleDetailItem label="Source" value={selectedLead.source} />
                <SimpleDetailItem label="Budget" value={selectedLead.budget?.toString() ?? "-"} />
                <SimpleDetailItem label="Area" value={selectedLead.area ?? "-"} />
                <SimpleDetailItem label="Location" value={selectedLead.location ?? "-"} />
                <SimpleDetailItem label="Created" value={new Date(selectedLead.created_at).toLocaleString()} />
                <SimpleDetailItem label="Updated" value={new Date(selectedLead.updated_at).toLocaleString()} />
              </dl>

              <div className="mt-5 border-t border-[#EAE7E2] pt-4">
                <p className="text-xs uppercase tracking-widest text-gray-500">Notes</p>
                <p className="mt-1 text-sm text-[#1A1A1A] whitespace-pre-wrap">{selectedLead.notes ?? "-"}</p>
              </div>

              <div className="mt-5 border-t border-[#EAE7E2] pt-4">
                <p className="text-xs uppercase tracking-widest text-gray-500">Custom Fields</p>
                {Object.keys(selectedLead.custom_fields ?? {}).length === 0 ? (
                  <p className="mt-1 text-sm text-gray-500">No custom fields</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {Object.entries(selectedLead.custom_fields ?? {}).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-start justify-between gap-4 rounded-md border border-[#EAE7E2] bg-[#FAF9F7] px-3 py-2"
                      >
                        <p className="text-xs uppercase tracking-wider text-gray-500">{formatCustomFieldLabel(key)}</p>
                        <p className="text-sm text-[#1A1A1A] text-right break-all">
                          {value === null || value === undefined || value === "" ? "-" : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 border-t border-[#EAE7E2] pt-4">
                <p className="text-xs uppercase tracking-widest text-gray-500">Activity Audit Trail</p>
                {selectedLeadStatusLogs.length === 0 ? (
                  <p className="mt-1 text-sm text-gray-500">No status transition logs yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {selectedLeadStatusLogs.map((log) => (
                      <div key={log.id} className="rounded-md border border-[#EAE7E2] bg-[#FAF9F7] px-3 py-2">
                        <p className="text-sm text-[#1A1A1A]">
                          {log.previous_status.replace("_", " ")} {"->"} {log.new_status.replace("_", " ")}
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          {new Date(log.created_at).toLocaleString()} • by {log.changed_by}
                        </p>
                        {log.change_note && <p className="mt-1 text-xs text-gray-700">{log.change_note}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
