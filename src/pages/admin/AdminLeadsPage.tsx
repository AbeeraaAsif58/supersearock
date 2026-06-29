"use client";

import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { LeadsFilterForm } from "@/components/admin/leads-filter-form";
import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";
import { requireAdmin } from "@/lib/auth/guards";
import type { Lead, LeadStatus, Profile } from "@/lib/auth/types";
import { sendBulkLeadAssignmentEmail, sendLeadAssignmentEmail } from "@/lib/email/client";
import { appRedirect } from "@/lib/navigation";
import { createDataClient } from "@/lib/supabase/client";

const UNASSIGNED_FILTER_VALUE = "__unassigned__";

const leadStatuses: LeadStatus[] = [
  "new",
  "assigned",
  "follow_up",
  "interested",
  "call_denied",
  "closed",
  "lost",
];

async function loadPageData(searchParams: URLSearchParams) {
  await requireAdmin();

  const filterStatus =
    searchParams.get("status") && [...leadStatuses, "all"].includes(searchParams.get("status")!)
      ? searchParams.get("status")!
      : "all";
  const filterSource = searchParams.get("source") ?? "";
  const filterArea = searchParams.get("area") ?? "";
  const filterAssignedAgent = searchParams.get("assigned") ?? "";
  const budgetMin = searchParams.get("budget_min") ?? "";
  const budgetMax = searchParams.get("budget_max") ?? "";
  const q = (searchParams.get("q") ?? "").trim();
  const pageParam = searchParams.get("page");
  const currentPage = pageParam && Number(pageParam) > 0 ? Number(pageParam) : 1;
  const pageSize = 10;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  const selectedLeadId = searchParams.get("lead_id") ?? "";
  const selectedEditLeadId = searchParams.get("edit_lead_id") ?? "";
  const message = searchParams.get("message") ? decodeURIComponent(searchParams.get("message")!) : undefined;
  const error = searchParams.get("error") ? decodeURIComponent(searchParams.get("error")!) : undefined;

  const adminClient = createDataClient();

  let leadsQuery = adminClient
    .from("leads")
    .select(
      "id,full_name,email,phone,source,budget,location,area,status,assigned_agent_id,notes,custom_fields,created_by,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (filterStatus !== "all") {
    leadsQuery = leadsQuery.eq("status", filterStatus);
  }
  if (filterSource) {
    leadsQuery = leadsQuery.ilike("source", `%${filterSource}%`);
  }
  if (filterArea) {
    leadsQuery = leadsQuery.ilike("area", `%${filterArea}%`);
  }
  if (filterAssignedAgent === UNASSIGNED_FILTER_VALUE) {
    leadsQuery = leadsQuery.is("assigned_agent_id", null);
  } else if (filterAssignedAgent) {
    leadsQuery = leadsQuery.eq("assigned_agent_id", filterAssignedAgent);
  }
  if (budgetMin) {
    leadsQuery = leadsQuery.gte("budget", Number(budgetMin));
  }
  if (budgetMax) {
    leadsQuery = leadsQuery.lte("budget", Number(budgetMax));
  }
  if (q) {
    leadsQuery = leadsQuery.or(
      `full_name.ilike.%${escapeIlike(q)}%,email.ilike.%${escapeIlike(q)}%,phone.ilike.%${escapeIlike(q)}%`,
    );
  }

  const leadsPromise = leadsQuery.range(from, to).returns<Lead[]>();
  let leadsCountQuery = adminClient
    .from("leads")
    .select("*", { head: true, count: "exact" });
  if (filterStatus !== "all") leadsCountQuery = leadsCountQuery.eq("status", filterStatus);
  if (filterSource) leadsCountQuery = leadsCountQuery.ilike("source", `%${filterSource}%`);
  if (filterArea) leadsCountQuery = leadsCountQuery.ilike("area", `%${filterArea}%`);
  if (filterAssignedAgent === UNASSIGNED_FILTER_VALUE) {
    leadsCountQuery = leadsCountQuery.is("assigned_agent_id", null);
  } else if (filterAssignedAgent) {
    leadsCountQuery = leadsCountQuery.eq("assigned_agent_id", filterAssignedAgent);
  }
  if (budgetMin) leadsCountQuery = leadsCountQuery.gte("budget", Number(budgetMin));
  if (budgetMax) leadsCountQuery = leadsCountQuery.lte("budget", Number(budgetMax));
  if (q) {
    leadsCountQuery = leadsCountQuery.or(
      `full_name.ilike.%${escapeIlike(q)}%,email.ilike.%${escapeIlike(q)}%,phone.ilike.%${escapeIlike(q)}%`,
    );
  }
  const leadsCountPromise = leadsCountQuery;
  const agentsPromise = adminClient
    .from("profiles")
    .select("id,email,role,status,is_primary_admin,created_at,updated_at")
    .eq("role", "agent")
    .in("status", ["active", "readonly"])
    .order("email", { ascending: true })
    .returns<Profile[]>();

  const [{ data: leads }, { count }, { data: agents }] = await Promise.all([
    leadsPromise,
    leadsCountPromise,
    agentsPromise,
  ]);
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const agentEmailById = new Map((agents ?? []).map((agent) => [agent.id, agent.email]));
  const selectedLead = (leads ?? []).find((lead) => lead.id === selectedLeadId) ?? null;
  const selectedEditLead = (leads ?? []).find((lead) => lead.id === selectedEditLeadId) ?? null;
  const baseQueryWithoutLeadId = buildLeadListQuery({
    page: String(safePage),
    status: filterStatus,
    source: filterSource,
    area: filterArea,
    assigned: filterAssignedAgent,
    budget_min: budgetMin,
    budget_max: budgetMax,
    q,
  });

  return {
    filterStatus,
    filterSource,
    filterArea,
    filterAssignedAgent,
    budgetMin,
    budgetMax,
    q,
    safePage,
    totalPages,
    totalCount,
    message,
    error,
    leads: leads ?? [],
    agents: agents ?? [],
    agentEmailById,
    selectedLead,
    selectedEditLead,
    baseQueryWithoutLeadId,
  };
}

export default function AdminLeadsPage() {
  const [searchParams] = useSearchParams();
  const { data, loading, reload } = usePageLoader(() => loadPageData(searchParams), [searchParams.toString()]);

  async function createLeadAction(formData: FormData) {
    const { profile: adminProfile } = await requireAdmin();
    const adminClient = createDataClient();

    const fullName = String(formData.get("full_name") ?? "").trim();
    const email = normalizeOptional(String(formData.get("email") ?? ""));
    const phone = normalizeOptional(String(formData.get("phone") ?? ""));
    const source = normalizeOptional(String(formData.get("source") ?? "")) ?? "manual";
    const budgetRaw = normalizeOptional(String(formData.get("budget") ?? ""));
    const location = normalizeOptional(String(formData.get("location") ?? ""));
    const area = normalizeOptional(String(formData.get("area") ?? ""));
    const notes = normalizeOptional(String(formData.get("notes") ?? ""));
    const assignedAgentId = normalizeOptional(String(formData.get("assigned_agent_id") ?? ""));
    const status = String(formData.get("status") ?? "new") as LeadStatus;
    const customKey = normalizeOptional(String(formData.get("custom_key") ?? ""));
    const customValue = normalizeOptional(String(formData.get("custom_value") ?? ""));

    if (!fullName || !phone) {
      appRedirect("/admin/leads?error=Full%20name%20and%20phone%20are%20required.");
      return;
    }
    if (!leadStatuses.includes(status)) {
      appRedirect("/admin/leads?error=Invalid%20lead%20status.");
      return;
    }

    await ensureNoDuplicateLead(adminClient, { email, phone });

    const customFields =
      customKey && customValue ? { [customKey]: customValue } : {};

    const { error } = await adminClient.from("leads").insert({
      full_name: fullName,
      email,
      phone,
      source,
      budget: budgetRaw ? Number(budgetRaw) : null,
      location,
      area,
      status,
      assigned_agent_id: assignedAgentId,
      notes,
      custom_fields: customFields,
      created_by: adminProfile.id,
    });

    if (error) {
      appRedirect(`/admin/leads?error=${encodeURIComponent(error.message)}`);
      return;
    }

    if (assignedAgentId) {
      const { data: assignedAgentProfile } = await adminClient
        .from("profiles")
        .select("email")
        .eq("id", assignedAgentId)
        .maybeSingle<{ email: string }>();

      if (assignedAgentProfile?.email) {
        try {
          await sendLeadAssignmentEmail({
            agentEmail: assignedAgentProfile.email,
            assignedByEmail: adminProfile.email,
            lead: {
              fullName,
              source,
              status,
              phone,
              email,
              area,
              location,
              budget: budgetRaw ? Number(budgetRaw) : null,
              notes,
            },
          });
        } catch (mailError) {
          console.error("Failed to send assignment email for new lead:", mailError);
        }
      }
    }

    reload();
    appRedirect("/admin/leads?message=Lead%20created%20successfully.");
  }

  async function uploadLeadsCsvAction(formData: FormData) {
    const { profile: adminProfile } = await requireAdmin();
    const adminClient = createDataClient();
    const file = formData.get("csv_file");
    const manualAssignedAgentId = formData.get("manual_assigned_agent_id") as string | null;

    if (!(file instanceof File)) {
      appRedirect("/admin/leads?error=CSV%20file%20is%20required.");
      return;
    }

    const csvText = await file.text();
    const rows = parseCsv(csvText);

    if (rows.length < 2) {
      appRedirect("/admin/leads?error=CSV%20must%20contain%20header%20and%20at%20least%20one%20row.");
      return;
    }

    const header = rows[0].map((col) => col.trim().toLowerCase());
    const idx = {
      full_name: header.indexOf("full_name"),
      email: header.indexOf("email"),
      phone: header.indexOf("phone"),
      source: header.indexOf("source"),
      budget: header.indexOf("budget"),
      location: header.indexOf("location"),
      area: header.indexOf("area"),
      status: header.indexOf("status"),
      assigned_agent_email: header.indexOf("assigned_agent_email"),
      notes: header.indexOf("notes"),
    };

    if (idx.full_name === -1 || idx.phone === -1) {
      appRedirect("/admin/leads?error=CSV%20must%20include%20full_name%20and%20phone%20columns.");
      return;
    }

    const { data: allAgents } = await adminClient
      .from("profiles")
      .select("id,email,role,status,is_primary_admin,created_at,updated_at")
      .eq("role", "agent")
      .in("status", ["active", "readonly"])
      .returns<Profile[]>();
    const agentByEmail = new Map((allAgents ?? []).map((a) => [a.email.toLowerCase(), a.id]));
    const agentEmailById = new Map((allAgents ?? []).map((a) => [a.id, a.email]));

    const candidateEmails = new Set<string>();
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const email = normalizeOptional(readCsvCell(row, idx.email))?.toLowerCase() ?? null;
      if (email) {
        candidateEmails.add(email);
      }
    }

    const existingEmails = new Set<string>();
    for (const emailChunk of chunkArray(Array.from(candidateEmails), 500)) {
      const { data: existingLeadsChunk } = await adminClient
        .from("leads")
        .select("email")
        .in("email", emailChunk)
        .returns<Array<{ email: string | null }>>();

      for (const lead of existingLeadsChunk ?? []) {
        if (!lead.email) continue;
        existingEmails.add(lead.email.toLowerCase());
      }
    }

    const rowsToInsert: Record<string, unknown>[] = [];
    const assignedSummaryByAgentId = new Map<string, { count: number; leadNames: string[] }>();
    const duplicateMessages: string[] = [];
    const uploadedEmails = new Set<string>();

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const fullName = normalizeOptional(readCsvCell(row, idx.full_name)) ?? "";
      const phone = normalizeOptional(readCsvCell(row, idx.phone)) ?? null;
      const source = normalizeOptional(readCsvCell(row, idx.source)) ?? "csv";
      if (!fullName || !phone) {
        continue;
      }
      const email = normalizeOptional(readCsvCell(row, idx.email))?.toLowerCase() ?? null;

      if (email && existingEmails.has(email)) {
        duplicateMessages.push(`Row ${i + 1}: duplicate email ${email}`);
        continue;
      }
      if (email && uploadedEmails.has(email)) {
        duplicateMessages.push(`Row ${i + 1}: duplicate email in CSV ${email}`);
        continue;
      }
      const statusRaw = normalizeOptional(readCsvCell(row, idx.status));
      const status = (statusRaw as LeadStatus) ?? "new";
      const safeStatus = leadStatuses.includes(status) ? status : "new";
      const assignedAgentEmail = normalizeOptional(readCsvCell(row, idx.assigned_agent_email))?.toLowerCase();
      const csvAssignedAgentId = assignedAgentEmail ? agentByEmail.get(assignedAgentEmail) ?? null : null;
      const assignedAgentId = manualAssignedAgentId || csvAssignedAgentId;
      const budgetRaw = normalizeOptional(readCsvCell(row, idx.budget));

      rowsToInsert.push({
        full_name: fullName,
        email,
        phone,
        source,
        budget: budgetRaw ? Number(budgetRaw) : null,
        location: normalizeOptional(readCsvCell(row, idx.location)),
        area: normalizeOptional(readCsvCell(row, idx.area)),
        status: safeStatus,
        assigned_agent_id: assignedAgentId,
        notes: normalizeOptional(readCsvCell(row, idx.notes)),
        custom_fields: {},
        created_by: adminProfile.id,
      });

      if (assignedAgentId) {
        const summary = assignedSummaryByAgentId.get(assignedAgentId) ?? { count: 0, leadNames: [] };
        summary.count += 1;
        if (summary.leadNames.length < 5) {
          summary.leadNames.push(fullName);
        }
        assignedSummaryByAgentId.set(assignedAgentId, summary);
      }

      if (email) uploadedEmails.add(email);
    }

    if (rowsToInsert.length > 0) {
      const { error } = await adminClient.from("leads").insert(rowsToInsert);
      if (error) {
        appRedirect(`/admin/leads?error=${encodeURIComponent(error.message)}`);
        return;
      }

      const notificationRows: Array<{
        user_id: string;
        title: string;
        message: string;
        notification_type: string;
        entity_type: string;
      }> = [];
      const emailTasks: Array<Promise<unknown>> = [];

      for (const [assignedAgentId, summary] of assignedSummaryByAgentId.entries()) {
        const assignedAgentEmail = agentEmailById.get(assignedAgentId);
        const leadWord = summary.count === 1 ? "lead" : "leads";
        notificationRows.push({
          user_id: assignedAgentId,
          title: "Bulk Leads Assigned",
          message: `${summary.count} ${leadWord} assigned to you from CSV upload by ${adminProfile.email}.`,
          notification_type: "assignment",
          entity_type: "lead",
        });

        if (!assignedAgentEmail) continue;
        emailTasks.push(
          sendBulkLeadAssignmentEmail({
            agentEmail: assignedAgentEmail,
            assignedByEmail: adminProfile.email,
            leadsCount: summary.count,
            leadNames: summary.leadNames,
          }).catch((mailError) => {
            console.error("Failed to send grouped assignment email for CSV upload:", mailError);
          }),
        );
      }

      if (notificationRows.length > 0) {
        const { error: notificationError } = await adminClient
          .from("notifications")
          .insert(notificationRows);
        if (notificationError) {
          console.error("Failed to insert grouped CSV assignment notifications:", notificationError);
        }
      }

      if (emailTasks.length > 0) {
        await Promise.allSettled(emailTasks);
      }
    }

    reload();
    const summary = `CSV processed. Added ${rowsToInsert.length} leads.${duplicateMessages.length ? ` Skipped ${duplicateMessages.length} duplicates.` : ""}`;
    appRedirect(`/admin/leads?message=${encodeURIComponent(summary)}`);
  }

  async function updateLeadAction(formData: FormData) {
    const { profile: adminProfile } = await requireAdmin();
    const adminClient = createDataClient();
    const leadId = String(formData.get("lead_id") ?? "");
    const returnQuery = String(formData.get("return_query") ?? "");
    const returnUrl = `/admin/leads${returnQuery ? `?${returnQuery}` : ""}`;
    const fullName = String(formData.get("full_name") ?? "").trim();
    const email = normalizeOptional(String(formData.get("email") ?? ""));
    const phone = normalizeOptional(String(formData.get("phone") ?? ""));
    const source = String(formData.get("source") ?? "").trim();
    const budgetRaw = normalizeOptional(String(formData.get("budget") ?? ""));
    const location = normalizeOptional(String(formData.get("location") ?? ""));
    const area = normalizeOptional(String(formData.get("area") ?? ""));
    const notes = normalizeOptional(String(formData.get("notes") ?? ""));
    const assignedAgentId = normalizeOptional(String(formData.get("assigned_agent_id") ?? ""));
    const status = String(formData.get("status") ?? "new") as LeadStatus;

    if (!leadId || !fullName || !source) {
      appRedirect(`${returnUrl}${returnQuery ? "&" : "?"}error=Required%20fields%20missing.`);
      return;
    }
    if (!leadStatuses.includes(status)) {
      appRedirect(`${returnUrl}${returnQuery ? "&" : "?"}error=Invalid%20lead%20status.`);
      return;
    }

    const { data: existingLead } = await adminClient
      .from("leads")
      .select("assigned_agent_id")
      .eq("id", leadId)
      .maybeSingle<{ assigned_agent_id: string | null }>();

    const { error } = await adminClient
      .from("leads")
      .update({
        full_name: fullName,
        email,
        phone,
        source,
        budget: budgetRaw ? Number(budgetRaw) : null,
        location,
        area,
        notes,
        assigned_agent_id: assignedAgentId,
        status,
      })
      .eq("id", leadId);

    if (error) {
      appRedirect(
        `${returnUrl}${returnQuery ? "&" : "?"}error=${encodeURIComponent(error.message)}`,
      );
      return;
    }

    const shouldSendAssignmentEmail =
      assignedAgentId && assignedAgentId !== (existingLead?.assigned_agent_id ?? null);

    if (shouldSendAssignmentEmail) {
      const { data: assignedAgentProfile } = await adminClient
        .from("profiles")
        .select("email")
        .eq("id", assignedAgentId)
        .maybeSingle<{ email: string }>();

      if (assignedAgentProfile?.email) {
        try {
          await sendLeadAssignmentEmail({
            agentEmail: assignedAgentProfile.email,
            assignedByEmail: adminProfile.email,
            lead: {
              fullName,
              source,
              status,
              phone,
              email,
              area,
              location,
              budget: budgetRaw ? Number(budgetRaw) : null,
              notes,
            },
          });
        } catch (mailError) {
          console.error("Failed to send assignment email for updated lead:", mailError);
        }
      }
    }

    reload();
    appRedirect(`${returnUrl}${returnQuery ? "&" : "?"}message=Lead%20updated%20successfully.`);
  }

  if (loading || !data) return <PageLoadingState />;

  const {
    filterStatus,
    filterSource,
    filterArea,
    filterAssignedAgent,
    budgetMin,
    budgetMax,
    q,
    safePage,
    totalPages,
    totalCount,
    message,
    error,
    leads,
    agents,
    agentEmailById,
    selectedLead,
    selectedEditLead,
    baseQueryWithoutLeadId,
  } = data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl tracking-tight text-[#1A1A1A]">Leads</h1>
        <p className="text-sm text-gray-600">
          Manual entry, CSV import, duplicate checks, and filterable lead management.
        </p>
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Manual Lead Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createLeadAction} className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <Input name="full_name" placeholder="Full name" className="h-10 rounded-lg" required />
            <Input name="email" type="email" placeholder="Email" className="h-10 rounded-lg" />
            <Input name="phone" placeholder="Phone" className="h-10 rounded-lg" required />
            <Input name="source" placeholder="Source (optional, e.g. Facebook Ads)" className="h-10 rounded-lg" />
            <Input name="budget" type="number" step="0.01" placeholder="Budget" className="h-10 rounded-lg" />
            <Input name="location" placeholder="Location" className="h-10 rounded-lg" />
            <Input name="area" placeholder="Area" className="h-10 rounded-lg" />
            <select name="status" defaultValue="new" className="h-10 rounded-lg border border-[#CEC8BF] px-3 text-sm bg-white">
              {leadStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select name="assigned_agent_id" defaultValue="" className="h-10 rounded-lg border border-[#CEC8BF] px-3 text-sm bg-white">
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.email}
                </option>
              ))}
            </select>
            <Input name="custom_key" placeholder="Custom field key (optional)" className="h-10 rounded-lg" />
            <Input name="custom_value" placeholder="Custom field value (optional)" className="h-10 rounded-lg" />
            <Input name="notes" placeholder="Notes (optional)" className="h-10 rounded-lg md:col-span-2" />
            <AdminFormSubmitButton
              idleText="Create lead"
              pendingText="Creating..."
              className="h-10 rounded-lg bg-[#E55B3C] text-white hover:bg-[#c94b2f]"
            />
          </form>
        </CardContent>
      </Card>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Bulk CSV Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">
            CSV columns: full_name,email,phone,source,budget,location,area,status,assigned_agent_email,notes
          </p>
          <form action={uploadLeadsCsvAction} className="grid grid-cols-1 md:grid-cols-[1fr_200px_220px] gap-2.5">
            <Input name="csv_file" type="file" accept=".csv,text/csv" required className="h-10 rounded-lg file:mr-3 file:border-0 file:bg-[#F4F1ED] file:px-3 file:py-1.5 file:rounded-md file:text-sm" />
            <select name="manual_assigned_agent_id" defaultValue="" className="h-10 rounded-lg border border-[#CEC8BF] px-3 text-sm bg-white">
              <option value="">No override (Use CSV)</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.email}
                </option>
              ))}
            </select>
            <AdminFormSubmitButton
              idleText="Upload and process"
              pendingText="Uploading..."
              className="h-10 rounded-lg bg-[#E55B3C] text-white hover:bg-[#c94b2f]"
            />
          </form>
        </CardContent>
      </Card>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Lead Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadsFilterForm
            q={q}
            filterStatus={filterStatus}
            filterSource={filterSource}
            filterArea={filterArea}
            filterAssignedAgent={filterAssignedAgent}
            budgetMin={budgetMin}
            budgetMax={budgetMax}
            agents={agents}
            leadStatuses={leadStatuses}
            unassignedFilterValue={UNASSIGNED_FILTER_VALUE}
          />
        </CardContent>
      </Card>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Lead List</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 && (
            <p className="text-sm text-gray-500">No leads found.</p>
          )}
          {leads.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[#EAE7E2]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAF9F7]">
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Area / Location</TableHead>
                    <TableHead>Assigned Agent</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.full_name}</TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {lead.email ?? "no-email"}
                        <br />
                        {lead.phone ?? "no-phone"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-[#F4F1ED] px-2 py-0.5 text-[11px] font-medium text-[#1A1A1A]">
                          {lead.source}
                        </span>
                      </TableCell>
                      <TableCell className="uppercase text-xs tracking-wider">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusClasses(lead.status)}`}>
                          {lead.status.replace("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell>{lead.budget ?? "-"}</TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {lead.area ?? "-"}
                        <br />
                        {lead.location ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {lead.assigned_agent_id ? (
                          <span className="inline-flex rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-medium text-[#166534]">
                            {agentEmailById.get(lead.assigned_agent_id) ?? "Unknown"}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to={`/admin/leads?${buildLeadListQuery({
                            status: filterStatus,
                            source: filterSource,
                            area: filterArea,
                            assigned: filterAssignedAgent,
                            budget_min: budgetMin,
                            budget_max: budgetMax,
                            q,
                            page: String(safePage),
                            lead_id: lead.id,
                          })}`}
                          className="inline-flex h-8 items-center rounded-md border border-[#E0DDD9] px-3 text-xs font-medium text-[#1A1A1A] hover:bg-[#F4F1ED]"
                        >
                          Details
                        </Link>
                        <Link
                          to={`/admin/leads?${buildLeadListQuery({
                            status: filterStatus,
                            source: filterSource,
                            area: filterArea,
                            assigned: filterAssignedAgent,
                            budget_min: budgetMin,
                            budget_max: budgetMax,
                            q,
                            page: String(safePage),
                            edit_lead_id: lead.id,
                          })}`}
                          className="ml-2 inline-flex h-8 items-center rounded-md border border-[#E0DDD9] px-3 text-xs font-medium text-[#1A1A1A] hover:bg-[#F4F1ED]"
                        >
                          Edit
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {leads.length > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Page {safePage} of {totalPages} ({totalCount} total leads)
              </p>
              <div className="flex gap-2">
                <Link
                  to={`/admin/leads?${buildLeadListQuery({
                    status: filterStatus,
                    source: filterSource,
                    area: filterArea,
                    assigned: filterAssignedAgent,
                    budget_min: budgetMin,
                    budget_max: budgetMax,
                    q,
                    page: String(Math.max(1, safePage - 1)),
                  })}`}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    safePage <= 1
                      ? "pointer-events-none border-gray-200 text-gray-400"
                      : "border-[#E0DDD9] text-[#1A1A1A] hover:bg-[#F4F1ED]"
                  }`}
                >
                  Previous
                </Link>
                <Link
                  to={`/admin/leads?${buildLeadListQuery({
                    status: filterStatus,
                    source: filterSource,
                    area: filterArea,
                    assigned: filterAssignedAgent,
                    budget_min: budgetMin,
                    budget_max: budgetMax,
                    q,
                    page: String(Math.min(totalPages, safePage + 1)),
                  })}`}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    safePage >= totalPages
                      ? "pointer-events-none border-gray-200 text-gray-400"
                      : "border-[#E0DDD9] text-[#1A1A1A] hover:bg-[#F4F1ED]"
                  }`}
                >
                  Next
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-[#E0DDD9] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EAE7E2] px-5 py-4">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-[#1A1A1A]">
                  Lead Details
                </h3>
                <p className="text-sm text-gray-500">{selectedLead.full_name}</p>
              </div>
              <Link
                to={`/admin/leads${baseQueryWithoutLeadId ? `?${baseQueryWithoutLeadId}` : ""}`}
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
                <SimpleDetailItem label="Source" value={selectedLead.source} />
                <SimpleDetailItem label="Status" value={selectedLead.status} />
                <SimpleDetailItem label="Budget" value={selectedLead.budget?.toString() ?? "-"} />
                <SimpleDetailItem label="Area" value={selectedLead.area ?? "-"} />
                <SimpleDetailItem label="Location" value={selectedLead.location ?? "-"} />
                <SimpleDetailItem
                  label="Assigned Agent"
                  value={
                    selectedLead.assigned_agent_id
                      ? (agentEmailById.get(selectedLead.assigned_agent_id) ?? "Unknown")
                      : "Unassigned"
                  }
                />
                <SimpleDetailItem
                  label="Created Date"
                  value={new Date(selectedLead.created_at).toLocaleString()}
                />
                <SimpleDetailItem
                  label="Updated Date"
                  value={new Date(selectedLead.updated_at).toLocaleString()}
                />
              </dl>

              <div className="mt-5 border-t border-[#EAE7E2] pt-4">
                <p className="text-xs uppercase tracking-widest text-gray-500">Notes</p>
                <p className="mt-1 text-sm text-[#1A1A1A] whitespace-pre-wrap">
                  {selectedLead.notes ?? "-"}
                </p>
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
                        <p className="text-xs uppercase tracking-wider text-gray-500">
                          {formatCustomFieldLabel(key)}
                        </p>
                        <p className="text-sm text-[#1A1A1A] text-right break-all">
                          {value === null || value === undefined || value === ""
                            ? "-"
                            : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedEditLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-[#E0DDD9] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EAE7E2] px-5 py-4">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-[#1A1A1A]">
                  Edit Lead
                </h3>
                <p className="text-sm text-gray-500">{selectedEditLead.full_name}</p>
              </div>
              <Link
                to={`/admin/leads${baseQueryWithoutLeadId ? `?${baseQueryWithoutLeadId}` : ""}`}
                className="rounded-md border border-[#E0DDD9] px-3 py-1.5 text-sm text-[#1A1A1A] hover:bg-[#F4F1ED]"
              >
                Close
              </Link>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              <form action={updateLeadAction} className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <input type="hidden" name="lead_id" value={selectedEditLead.id} />
                <input type="hidden" name="return_query" value={baseQueryWithoutLeadId} />
                <LabeledInput label="Full Name" name="full_name" defaultValue={selectedEditLead.full_name} required />
                <LabeledInput label="Email" name="email" defaultValue={selectedEditLead.email ?? ""} />
                <LabeledInput label="Phone" name="phone" defaultValue={selectedEditLead.phone ?? ""} />
                <LabeledInput label="Source" name="source" defaultValue={selectedEditLead.source} required />
                <LabeledInput
                  label="Budget"
                  name="budget"
                  type="number"
                  step="0.01"
                  defaultValue={selectedEditLead.budget?.toString() ?? ""}
                />
                <LabeledInput label="Location" name="location" defaultValue={selectedEditLead.location ?? ""} />
                <LabeledInput label="Area" name="area" defaultValue={selectedEditLead.area ?? ""} />
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-widest text-gray-500">Status</label>
                  <select
                    name="status"
                    defaultValue={selectedEditLead.status}
                    className="h-10 w-full rounded-lg border border-[#CEC8BF] px-3 text-sm bg-white"
                  >
                    {leadStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-widest text-gray-500">Assigned Agent</label>
                  <select
                    name="assigned_agent_id"
                    defaultValue={selectedEditLead.assigned_agent_id ?? ""}
                    className="h-10 w-full rounded-lg border border-[#CEC8BF] px-3 text-sm bg-white"
                  >
                    <option value="">Unassigned</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs uppercase tracking-widest text-gray-500">Notes</label>
                  <Input
                    name="notes"
                    defaultValue={selectedEditLead.notes ?? ""}
                    className="h-10 rounded-lg"
                    placeholder="Notes"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <AdminFormSubmitButton
                    idleText="Save changes"
                    pendingText="Saving..."
                    className="h-10 rounded-lg bg-[#E55B3C] text-white hover:bg-[#c94b2f]"
                  />
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-[#1A1A1A] break-words">{value}</dd>
    </div>
  );
}

function LabeledInput(props: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs uppercase tracking-widest text-gray-500">{props.label}</label>
      <Input
        name={props.name}
        defaultValue={props.defaultValue}
        type={props.type}
        step={props.step}
        required={props.required}
        className="h-10 rounded-lg"
      />
    </div>
  );
}

async function ensureNoDuplicateLead(
  adminClient: ReturnType<typeof createDataClient>,
  input: { email: string | null; phone: string | null },
) {
  if (!input.email) {
    return;
  }

  const query = adminClient
    .from("leads")
    .select("id,email")
    .eq("email", input.email)
    .limit(1);

  const { data } = await query;
  if ((data ?? []).length > 0) {
    appRedirect("/admin/leads?error=Duplicate%20lead%20detected%20by%20email.");
    throw new Error("DUPLICATE_LEAD");
  }
}

function parseCsv(csv: string) {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => parseCsvLine(line));
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function readCsvCell(row: string[], index: number) {
  if (index < 0 || index >= row.length) return "";
  return row[index] ?? "";
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, "\\$&");
}

function buildLeadListQuery(params: Record<string, string>) {
  const urlSearchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim().length > 0) {
      urlSearchParams.set(key, value);
    }
  });
  return urlSearchParams.toString();
}

function formatCustomFieldLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkArray<T>(items: T[], size: number) {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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
