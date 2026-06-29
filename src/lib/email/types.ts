export type LeadAssignmentEmailInput = {
  agentEmail: string;
  lead: {
    fullName: string;
    source: string;
    status: string;
    phone?: string | null;
    email?: string | null;
    area?: string | null;
    location?: string | null;
    budget?: number | null;
    notes?: string | null;
  };
  assignedByEmail: string;
};

export type BulkLeadAssignmentEmailInput = {
  agentEmail: string;
  assignedByEmail: string;
  leadsCount: number;
  leadNames: string[];
};

export type RoundRobinSummaryEmailInput = {
  agentEmail: string;
  totalLeads: number;
  leadNames: string[];
  batchCount: number;
  assignedByEmail: string;
};
