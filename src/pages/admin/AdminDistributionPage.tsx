"use client";

import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { RoundRobinRunner } from "@/components/admin/round-robin-runner";
import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";
import { requireAdmin } from "@/lib/auth/guards";
import type { Lead, LeadAssignmentLog, LeadAssignmentRule, Profile } from "@/lib/auth/types";
import { appRedirect } from "@/lib/navigation";
import { createDataClient } from "@/lib/supabase/client";

async function loadPageData(searchParams: URLSearchParams) {
  await requireAdmin();
  const adminClient = createDataClient();
  const tabParam = searchParams.get("tab");
  const activeTab =
    tabParam === "manual" || tabParam === "round-robin" || tabParam === "rules" || tabParam === "audit"
      ? tabParam
      : "manual";

  const { data: agents } = await adminClient
    .from("profiles")
    .select("id,email,role,status,is_primary_admin,created_at,updated_at")
    .eq("role", "agent")
    .in("status", ["active", "readonly"])
    .order("email", { ascending: true })
    .returns<Profile[]>();

  const { data: pendingLeads } = await adminClient
    .from("leads")
    .select("id,full_name,email,phone,source,budget,location,area,status,assigned_agent_id,notes,custom_fields,created_by,created_at,updated_at")
    .in("status", ["new", "assigned", "follow_up", "interested"])
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<Lead[]>();

  const { count: unassignedEligibleCount = 0 } = await adminClient
    .from("leads")
    .select("*", { head: true, count: "exact" })
    .is("assigned_agent_id", null)
    .in("status", ["new", "assigned", "follow_up", "interested"]);

  const { data: rules } = await adminClient
    .from("lead_assignment_rules")
    .select("id,name,area_keyword,source_match,property_type,agent_id,priority,is_active,created_by,created_at,updated_at")
    .order("priority", { ascending: true })
    .returns<LeadAssignmentRule[]>();

  const { data: logs } = await adminClient
    .from("lead_assignment_logs")
    .select("id,lead_id,previous_agent_id,new_agent_id,assigned_by,method,notes,created_at")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<LeadAssignmentLog[]>();

  const agentMap = new Map((agents ?? []).map((a) => [a.id, a.email]));
  const leadMap = new Map((pendingLeads ?? []).map((l) => [l.id, l.full_name]));
  const activeRulesCount = (rules ?? []).filter((rule) => rule.is_active).length;
  const manualCount = (pendingLeads ?? []).length;
  const roundRobinCount = unassignedEligibleCount ?? 0;
  const rulesCount = (rules ?? []).length;
  const auditCount = (logs ?? []).length;

  return {
    activeTab,
    agents: agents ?? [],
    pendingLeads: pendingLeads ?? [],
    unassignedEligibleCount: unassignedEligibleCount ?? 0,
    rules: rules ?? [],
    logs: logs ?? [],
    agentMap,
    leadMap,
    activeRulesCount,
    manualCount,
    roundRobinCount,
    rulesCount,
    auditCount,
  };
}

export default function AdminDistributionPage() {
  const [searchParams] = useSearchParams();
  const { data, loading, reload } = usePageLoader(() => loadPageData(searchParams), [searchParams.toString()]);

  async function createAssignmentRuleAction(formData: FormData) {
    const { profile: adminProfile } = await requireAdmin();
    const adminClient = createDataClient();

    const name = String(formData.get("name") ?? "").trim();
    const areaKeyword = normalizeOptional(String(formData.get("area_keyword") ?? ""));
    const sourceMatch = normalizeOptional(String(formData.get("source_match") ?? ""));
    const propertyType = normalizeOptional(String(formData.get("property_type") ?? ""));
    const priority = Number(String(formData.get("priority") ?? "100"));
    const agentId = String(formData.get("agent_id") ?? "");
    const isActive = formData.get("is_active") === "on";

    if (!name || !agentId) {
      appRedirect("/admin/distribution?error=Rule%20name%20and%20agent%20are%20required.");
      return;
    }

    const { error } = await adminClient.from("lead_assignment_rules").insert({
      name,
      area_keyword: areaKeyword,
      source_match: sourceMatch,
      property_type: propertyType,
      priority: Number.isFinite(priority) ? priority : 100,
      agent_id: agentId,
      is_active: isActive,
      created_by: adminProfile.id,
    });

    if (error) {
      appRedirect(`/admin/distribution?error=${encodeURIComponent(error.message)}`);
      return;
    }

    reload();
    appRedirect("/admin/distribution?message=Assignment%20rule%20created.");
  }

  async function toggleRuleStatusAction(formData: FormData) {
    await requireAdmin();
    const adminClient = createDataClient();
    const ruleId = String(formData.get("rule_id") ?? "");
    const isActive = String(formData.get("is_active") ?? "") === "true";

    const { error } = await adminClient
      .from("lead_assignment_rules")
      .update({ is_active: isActive })
      .eq("id", ruleId);

    if (error) {
      appRedirect(`/admin/distribution?error=${encodeURIComponent(error.message)}`);
      return;
    }

    reload();
    appRedirect("/admin/distribution?message=Rule%20status%20updated.");
  }

  async function manualAssignLeadAction(formData: FormData) {
    const { profile: adminProfile } = await requireAdmin();
    const adminClient = createDataClient();
    const leadId = String(formData.get("lead_id") ?? "");
    const agentId = String(formData.get("agent_id") ?? "");
    const notes = normalizeOptional(String(formData.get("notes") ?? ""));

    if (!leadId || !agentId) {
      appRedirect("/admin/distribution?error=Lead%20and%20agent%20are%20required.");
      return;
    }

    const { data: existingLead } = await adminClient
      .from("leads")
      .select("assigned_agent_id,status")
      .eq("id", leadId)
      .single<{ assigned_agent_id: string | null; status: string }>();

    const { error } = await adminClient
      .from("leads")
      .update({ assigned_agent_id: agentId, status: "assigned" })
      .eq("id", leadId);

    if (error) {
      appRedirect(`/admin/distribution?error=${encodeURIComponent(error.message)}`);
      return;
    }

    await createAssignmentLog({
      leadId,
      previousAgentId: existingLead?.assigned_agent_id ?? null,
      newAgentId: agentId,
      assignedBy: adminProfile.id,
      method: "manual",
      notes,
    });

    reload();
    appRedirect("/admin/distribution?message=Lead%20assignment%20saved.");
  }

  async function runRuleBasedAssignmentAction() {
    const { profile: adminProfile } = await requireAdmin();
    const adminClient = createDataClient();

    const { data: rules } = await adminClient
      .from("lead_assignment_rules")
      .select("id,name,area_keyword,source_match,property_type,agent_id,priority,is_active,created_by,created_at,updated_at")
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .returns<LeadAssignmentRule[]>();

    if (!rules || rules.length === 0) {
      appRedirect("/admin/distribution?error=No%20active%20assignment%20rules%20found.");
      return;
    }

    const { data: leads } = await adminClient
      .from("leads")
      .select("id,area,source,custom_fields,assigned_agent_id,status")
      .is("assigned_agent_id", null)
      .in("status", ["new", "assigned", "follow_up"]);

    if (!leads || leads.length === 0) {
      appRedirect("/admin/distribution?message=No%20eligible%20unassigned%20leads%20for%20rule%20assignment.");
      return;
    }

    let assignedCount = 0;
    for (const lead of leads) {
      const matchedRule = rules.find((rule) => {
        const areaOk = !rule.area_keyword || (lead.area ?? "").toLowerCase().includes(rule.area_keyword.toLowerCase());
        const sourceOk = !rule.source_match || (lead.source ?? "").toLowerCase().includes(rule.source_match.toLowerCase());
        const propertyType = getLeadPropertyType(lead.custom_fields as Record<string, unknown> | null);
        const propertyOk = !rule.property_type || propertyType.toLowerCase() === rule.property_type.toLowerCase();
        return areaOk && sourceOk && propertyOk;
      });

      if (!matchedRule) continue;

      await adminClient
        .from("leads")
        .update({ assigned_agent_id: matchedRule.agent_id, status: "assigned" })
        .eq("id", lead.id);

      await createAssignmentLog({
        leadId: lead.id,
        previousAgentId: lead.assigned_agent_id,
        newAgentId: matchedRule.agent_id,
        assignedBy: adminProfile.id,
        method: "rule",
        notes: `Matched rule: ${matchedRule.name}`,
      });
      assignedCount += 1;
    }

    reload();
    appRedirect(`/admin/distribution?message=${encodeURIComponent(`Rule engine assigned ${assignedCount} leads.`)}`);
  }

  if (loading || !data) return <PageLoadingState />;

  const {
    activeTab,
    agents,
    pendingLeads,
    unassignedEligibleCount,
    rules,
    logs,
    agentMap,
    leadMap,
    activeRulesCount,
    manualCount,
    roundRobinCount,
    rulesCount,
    auditCount,
  } = data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl tracking-tight text-[#1A1A1A]">Distribution Engine</h1>
        <p className="text-sm text-gray-600">
          Manual assignment, round-robin automation, area/source rules, and reassignment audit trail.
        </p>
      </div>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>How To Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700">
          <p>These are action buttons (not tabs).</p>
          <p>
            1) Use <span className="font-medium">Create Assignment Rule</span> to add at least one active rule. 2) Click
            <span className="font-medium"> Run Area/Source Rule Assignment</span>.
          </p>
          <p>
            <span className="font-medium">Round-robin</span> assigns only unassigned leads to active agents in sequence.
          </p>
          <p className="text-xs text-gray-500">
            Current state: {unassignedEligibleCount} unassigned leads, {agents.length} assignable agents, {activeRulesCount} active rules.
          </p>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-[#E0DDD9] bg-white p-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Link
            to="/admin/distribution?tab=manual"
            className={`inline-flex h-10 items-center justify-center rounded-lg border text-sm font-medium transition ${
              activeTab === "manual"
                ? "border-[#E55B3C] bg-[#E55B3C] text-white"
                : "border-[#EAE7E2] bg-white text-[#1A1A1A] hover:bg-[#F7F4EF]"
            }`}
          >
            <span>Manual</span>
            <span className={`ml-2 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs ${
              activeTab === "manual" ? "bg-white/20 text-white" : "bg-[#F4F1ED] text-[#1A1A1A]"
            }`}>
              {manualCount}
            </span>
          </Link>
          <Link
            to="/admin/distribution?tab=round-robin"
            className={`inline-flex h-10 items-center justify-center rounded-lg border text-sm font-medium transition ${
              activeTab === "round-robin"
                ? "border-[#E55B3C] bg-[#E55B3C] text-white"
                : "border-[#EAE7E2] bg-white text-[#1A1A1A] hover:bg-[#F7F4EF]"
            }`}
          >
            <span>Round Robin</span>
            <span className={`ml-2 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs ${
              activeTab === "round-robin" ? "bg-white/20 text-white" : "bg-[#F4F1ED] text-[#1A1A1A]"
            }`}>
              {roundRobinCount}
            </span>
          </Link>
          <Link
            to="/admin/distribution?tab=rules"
            className={`inline-flex h-10 items-center justify-center rounded-lg border text-sm font-medium transition ${
              activeTab === "rules"
                ? "border-[#E55B3C] bg-[#E55B3C] text-white"
                : "border-[#EAE7E2] bg-white text-[#1A1A1A] hover:bg-[#F7F4EF]"
            }`}
          >
            <span>Rules</span>
            <span className={`ml-2 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs ${
              activeTab === "rules" ? "bg-white/20 text-white" : "bg-[#F4F1ED] text-[#1A1A1A]"
            }`}>
              {rulesCount}
            </span>
          </Link>
          <Link
            to="/admin/distribution?tab=audit"
            className={`inline-flex h-10 items-center justify-center rounded-lg border text-sm font-medium transition ${
              activeTab === "audit"
                ? "border-[#E55B3C] bg-[#E55B3C] text-white"
                : "border-[#EAE7E2] bg-white text-[#1A1A1A] hover:bg-[#F7F4EF]"
            }`}
          >
            <span>Audit</span>
            <span className={`ml-2 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs ${
              activeTab === "audit" ? "bg-white/20 text-white" : "bg-[#F4F1ED] text-[#1A1A1A]"
            }`}>
              {auditCount}
            </span>
          </Link>
        </div>
      </div>

      {activeTab === "round-robin" && (
        <Card className="border-[#E0DDD9] bg-white">
          <CardHeader>
            <CardTitle>Round-Robin Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Assigns all eligible unassigned leads in sequence to active agents. Runs in parallel batches of 50.
            </p>
            <RoundRobinRunner initialRemaining={unassignedEligibleCount} onComplete={reload} />
          </CardContent>
        </Card>
      )}

      {activeTab === "rules" && (
        <div className="space-y-4">
          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Create Assignment Rule</CardTitle>
              <p className="text-sm text-gray-500">
                Rules automatically assign leads based on matching criteria. Priority determines the order of evaluation (lower number = evaluated first).
              </p>
            </CardHeader>
            <CardContent>
              <form action={createAssignmentRuleAction} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Rule Name</label>
                  <Input name="name" placeholder="e.g. DHA Facebook Leads" className="h-10 rounded-lg" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Area Keyword</label>
                  <Input name="area_keyword" placeholder="e.g. DHA" className="h-10 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Source Match</label>
                  <Input name="source_match" placeholder="e.g. Facebook Ads" className="h-10 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Property Type</label>
                  <Input name="property_type" placeholder="e.g. Commercial" className="h-10 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Priority (1 = Highest)</label>
                  <Input name="priority" type="number" defaultValue="100" className="h-10 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Assign To</label>
                  <select name="agent_id" className="h-10 w-full rounded-lg border border-[#CEC8BF] px-3 text-sm bg-white shadow-sm" required>
                    <option value="">Select agent...</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 lg:col-span-3 flex items-center justify-between pt-2 border-t border-[#EAE7E2]">
                  <label className="inline-flex items-center gap-2 text-sm text-[#1A1A1A] font-medium cursor-pointer">
                    <input name="is_active" type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-[#E55B3C] focus:ring-[#E55B3C]" />
                    Rule is Active
                  </label>
                  <AdminFormSubmitButton
                    idleText="Save rule"
                    pendingText="Saving..."
                    className="h-10 rounded-lg bg-[#E55B3C] text-white hover:bg-[#c94b2f] px-6"
                  />
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Active Assignment Rules</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Manage your existing rules. You can run all active rules against unassigned leads anytime.
                </p>
              </div>
              <form action={runRuleBasedAssignmentAction}>
                <AdminFormSubmitButton
                  idleText="Run Rules Now"
                  pendingText="Running..."
                  className="h-10 rounded-lg bg-[#1A1A1A] text-white hover:bg-[#333333] px-6"
                />
              </form>
            </CardHeader>
            <CardContent className="space-y-3">
              {rules.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#CEC8BF] bg-[#FAF9F7] p-8 text-center">
                  <p className="text-sm text-gray-500">No rules created yet. Create your first rule above.</p>
                </div>
              )}
              {rules.map((rule) => (
                <div key={rule.id} className={`rounded-xl border ${rule.is_active ? "border-[#EAE7E2] bg-[#FCFBFA]" : "border-gray-200 bg-gray-50 opacity-75"} p-4 transition-all`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#1A1A1A] text-base">{rule.name}</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${rule.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                          {rule.is_active ? "active" : "inactive"}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium tracking-wide text-blue-700 uppercase border border-blue-100">
                          Priority {rule.priority}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Area</p>
                          <p className="text-[#1A1A1A] font-medium">{rule.area_keyword || "Any"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Source</p>
                          <p className="text-[#1A1A1A] font-medium">{rule.source_match || "Any"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Property</p>
                          <p className="text-[#1A1A1A] font-medium">{rule.property_type || "Any"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Assigns To</p>
                          <p className="text-[#1A1A1A] font-medium truncate" title={agentMap.get(rule.agent_id) ?? "Unknown"}>
                            {agentMap.get(rule.agent_id) ?? "Unknown"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <form action={toggleRuleStatusAction} className="shrink-0 self-start sm:self-center">
                      <input type="hidden" name="rule_id" value={rule.id} />
                      <input type="hidden" name="is_active" value={String(!rule.is_active)} />
                      <AdminFormSubmitButton
                        idleText={rule.is_active ? "Disable" : "Enable"}
                        pendingText="Updating..."
                        variant="outline"
                        className="h-9 rounded-lg text-xs font-medium w-full sm:w-auto min-w-[80px]"
                      />
                    </form>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "manual" && (
        <Card className="border-[#E0DDD9] bg-white">
          <CardHeader>
            <CardTitle>Manual Assignment / Reassignment</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[520px] overflow-y-auto space-y-2 pr-1">
            {pendingLeads.length === 0 && (
              <p className="text-sm text-gray-500">No leads available for assignment.</p>
            )}
            {pendingLeads.map((lead) => (
              <form
                key={lead.id}
                action={manualAssignLeadAction}
                className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3 grid grid-cols-1 md:grid-cols-[1fr_240px_170px] gap-2"
              >
                <div>
                  <p className="font-medium text-[#1A1A1A]">{lead.full_name}</p>
                  <p className="text-xs text-gray-600">
                    {lead.email ?? "no-email"} • {lead.phone ?? "no-phone"} • area: {lead.area ?? "-"} • source: {lead.source}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Current agent: {lead.assigned_agent_id ? (agentMap.get(lead.assigned_agent_id) ?? "Unknown") : "Unassigned"}
                  </p>
                </div>
                <div className="space-y-2">
                  <input type="hidden" name="lead_id" value={lead.id} />
                  <select
                    name="agent_id"
                    className="h-10 w-full rounded-lg border border-[#CEC8BF] px-3 text-sm bg-white"
                    required
                    defaultValue={lead.assigned_agent_id ?? ""}
                  >
                    <option value="">Select agent...</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.email}
                      </option>
                    ))}
                  </select>
                  <Input name="notes" placeholder="Reassignment note (optional)" className="h-10 rounded-lg" />
                </div>
                <AdminFormSubmitButton
                  idleText="Save Assignment"
                  pendingText="Saving..."
                  className="h-10 rounded-lg bg-[#E55B3C] hover:bg-[#c94b2f] self-end"
                />
              </form>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "audit" && (
        <Card className="border-[#E0DDD9] bg-white">
          <CardHeader>
            <CardTitle>Assignment Audit Trail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {logs.length === 0 && (
              <p className="text-sm text-gray-500">No assignment logs yet.</p>
            )}
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3 text-sm">
                <p className="text-[#1A1A1A]">
                  Lead <span className="font-medium">{leadMap.get(log.lead_id) ?? log.lead_id}</span> →
                  <span className="font-medium"> {agentMap.get(log.new_agent_id) ?? "Unknown"}</span>
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Method: {log.method} • Previous: {log.previous_agent_id ? (agentMap.get(log.previous_agent_id) ?? "Unknown") : "none"} • {new Date(log.created_at).toLocaleString()}
                </p>
                {log.notes && <p className="mt-1 text-xs text-gray-500">{log.notes}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function createAssignmentLog(input: {
  leadId: string;
  previousAgentId: string | null;
  newAgentId: string;
  assignedBy: string;
  method: "manual" | "round_robin" | "rule";
  notes: string | null;
}) {
  const adminClient = createDataClient();
  await adminClient.from("lead_assignment_logs").insert({
    lead_id: input.leadId,
    previous_agent_id: input.previousAgentId,
    new_agent_id: input.newAgentId,
    assigned_by: input.assignedBy,
    method: input.method,
    notes: input.notes,
  });
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function getLeadPropertyType(customFields: Record<string, unknown> | null) {
  if (!customFields) return "";
  const value = customFields.property_type;
  return typeof value === "string" ? value : "";
}
