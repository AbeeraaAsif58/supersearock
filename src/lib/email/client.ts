import { invokeEdgeFunction } from "@/lib/supabase/functions";
import type { LeadAssignmentEmailInput, BulkLeadAssignmentEmailInput } from "@/lib/email/types";

export async function sendLeadAssignmentEmail(input: LeadAssignmentEmailInput) {
  try {
    await invokeEdgeFunction("send-email", { type: "lead-assignment", ...input });
    return { sent: true as const };
  } catch {
    return { sent: false, reason: "edge_function_error" as const };
  }
}

export async function sendBulkLeadAssignmentEmail(input: BulkLeadAssignmentEmailInput) {
  try {
    await invokeEdgeFunction("send-email", { type: "bulk-lead-assignment", ...input });
    return { sent: true as const };
  } catch {
    return { sent: false, reason: "edge_function_error" as const };
  }
}

export async function sendRoundRobinSummaryEmail(input: {
  agentEmail: string;
  totalLeads: number;
  leadNames: string[];
  batchCount: number;
  assignedByEmail: string;
}) {
  try {
    await invokeEdgeFunction("send-email", { type: "round-robin-summary", ...input });
    return { sent: true as const };
  } catch {
    return { sent: false, reason: "edge_function_error" as const };
  }
}

export async function sendManualFollowUpEmail(input: Record<string, unknown>) {
  try {
    await invokeEdgeFunction("send-email", { type: "manual-follow-up", ...input });
    return { sent: true as const };
  } catch {
    return { sent: false, reason: "edge_function_error" as const };
  }
}
