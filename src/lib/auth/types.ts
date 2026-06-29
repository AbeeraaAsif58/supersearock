export type AppRole = "admin" | "agent";

export type AgentStatus = "active" | "blocked" | "readonly";

export type Profile = {
  id: string;
  email: string;
  role: AppRole;
  status: AgentStatus;
  is_primary_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminActionLog = {
  id: string;
  actor_id: string;
  actor_email: string;
  target_user_id: string | null;
  target_email: string | null;
  action_type: string;
  action_payload: Record<string, unknown> | null;
  created_at: string;
};

export type LeadStatus =
  | "new"
  | "assigned"
  | "follow_up"
  | "interested"
  | "call_denied"
  | "closed"
  | "lost";

export type Lead = {
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
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type LeadAssignmentRule = {
  id: string;
  name: string;
  area_keyword: string | null;
  source_match: string | null;
  property_type: string | null;
  agent_id: string;
  priority: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type LeadAssignmentLog = {
  id: string;
  lead_id: string;
  previous_agent_id: string | null;
  new_agent_id: string;
  assigned_by: string;
  method: "manual" | "round_robin" | "rule" | string;
  notes: string | null;
  created_at: string;
};

export type FollowUpActivityType = "note" | "call" | "message";

export type LeadFollowUpActivity = {
  id: string;
  lead_id: string;
  actor_id: string;
  activity_type: FollowUpActivityType | string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type FollowUpTaskStatus = "pending" | "completed" | "missed";

export type FollowUpTask = {
  id: string;
  lead_id: string;
  assigned_agent_id: string | null;
  title: string;
  task_type: "call" | "message" | "meeting" | "follow_up" | string;
  notes: string | null;
  scheduled_for: string;
  due_at: string;
  status: FollowUpTaskStatus | string;
  reminder_enabled: boolean;
  completed_at: string | null;
  reminder_sent_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

export type CrmSettings = {
  id: boolean;
  company_name: string;
  company_email: string | null;
  company_phone: string | null;
  timezone: string;
  address: string | null;
  logo_url: string | null;
  round_robin_enabled: boolean;
  auto_assign_on_lead_create: boolean;
  default_assignment_mode: "manual" | "round_robin" | "rules" | string;
  daily_reminder_hour: number;
  overdue_alerts_enabled: boolean;
  reminder_email_enabled: boolean;
  reminder_in_app_enabled: boolean;
  reminder_whatsapp_enabled: boolean;
  mandatory_transition_notes: boolean;
  close_lost_requires_activity: boolean;
  sla_follow_up_delay_hours: number;
  session_timeout_minutes: number;
  enforce_strong_password: boolean;
  password_rotation_days: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
