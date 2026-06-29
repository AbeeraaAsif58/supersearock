import { createDataClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/auth/guards";
import { sendRoundRobinSummaryEmail } from "@/lib/email/client";
import type { Profile } from "@/lib/auth/types";

const BATCH_SIZE = 50;

export type RoundRobinStatus = {
  runId: string;
  state: "running" | "completed" | "failed";
  totalLeads: number;
  remainingLeads: number;
  processedLeads: number;
  totalBatches: number;
  completedBatches: number;
  notificationsSent: number;
  message?: string;
};

export async function runRoundRobin(
  onProgress: (status: RoundRobinStatus) => void,
): Promise<RoundRobinStatus> {
  const { profile: adminProfile } = await requireAdmin();
  const client = createDataClient();

  const { data: agents } = await client
    .from("profiles")
    .select("id,email,role,status,is_primary_admin,created_at,updated_at")
    .eq("role", "agent")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .returns<Profile[]>();

  if (!agents || agents.length === 0) {
    throw new Error("No active agents available.");
  }

  const { data: leads } = await client
    .from("leads")
    .select("id,full_name,assigned_agent_id")
    .is("assigned_agent_id", null)
    .in("status", ["new", "assigned", "follow_up", "interested"])
    .order("created_at", { ascending: true })
    .returns<Array<{ id: string; full_name: string; assigned_agent_id: string | null }>>();

  if (!leads || leads.length === 0) {
    throw new Error("No unassigned leads to distribute.");
  }

  const runId = crypto.randomUUID();
  const totalBatches = Math.ceil(leads.length / BATCH_SIZE);
  const status: RoundRobinStatus = {
    runId,
    state: "running",
    totalLeads: leads.length,
    remainingLeads: leads.length,
    processedLeads: 0,
    totalBatches,
    completedBatches: 0,
    notificationsSent: 0,
  };
  onProgress(status);

  const assignedLeadNamesByAgent = new Map<string, string[]>();

  try {
    for (let batchStart = 0; batchStart < leads.length; batchStart += BATCH_SIZE) {
      const batch = leads.slice(batchStart, batchStart + BATCH_SIZE);
      const assignments = batch.map((lead, offset) => {
        const globalIndex = batchStart + offset;
        const agent = agents[globalIndex % agents.length];
        return {
          leadId: lead.id,
          leadName: lead.full_name,
          previousAgentId: lead.assigned_agent_id,
          newAgentId: agent.id,
        };
      });

      assignments.forEach((assignment) => {
        const list = assignedLeadNamesByAgent.get(assignment.newAgentId) ?? [];
        list.push(assignment.leadName);
        assignedLeadNamesByAgent.set(assignment.newAgentId, list);
      });

      await Promise.all(
        assignments.map((assignment) =>
          client
            .from("leads")
            .update({ assigned_agent_id: assignment.newAgentId, status: "assigned" })
            .eq("id", assignment.leadId),
        ),
      );

      await client.from("lead_assignment_logs").insert(
        assignments.map((assignment) => ({
          lead_id: assignment.leadId,
          previous_agent_id: assignment.previousAgentId,
          new_agent_id: assignment.newAgentId,
          assigned_by: adminProfile.id,
          method: "round_robin",
          notes: "Automatic round-robin assignment",
        })),
      );

      const processedLeads = Math.min(batchStart + batch.length, leads.length);
      status.processedLeads = processedLeads;
      status.remainingLeads = leads.length - processedLeads;
      status.completedBatches = Math.ceil(processedLeads / BATCH_SIZE);
      onProgress({ ...status });
    }

    const agentEmailById = new Map(agents.map((agent) => [agent.id, agent.email]));
    let notificationsSent = 0;

    await Promise.all(
      Array.from(assignedLeadNamesByAgent.entries()).map(async ([agentId, leadNames]) => {
        const agentEmail = agentEmailById.get(agentId);
        if (!agentEmail || leadNames.length === 0) return;
        try {
          await sendRoundRobinSummaryEmail({
            agentEmail,
            totalLeads: leadNames.length,
            leadNames,
            batchCount: totalBatches,
            assignedByEmail: adminProfile.email,
          });
          notificationsSent += 1;
        } catch {
          // Ignore email failures.
        }
      }),
    );

    const completed: RoundRobinStatus = {
      ...status,
      state: "completed",
      processedLeads: leads.length,
      remainingLeads: 0,
      completedBatches: totalBatches,
      notificationsSent,
      message: `Assigned ${leads.length} leads.`,
    };
    onProgress(completed);
    return completed;
  } catch (error) {
    const failed: RoundRobinStatus = {
      ...status,
      state: "failed",
      message: error instanceof Error ? error.message : "Round-robin failed.",
    };
    onProgress(failed);
    return failed;
  }
}
