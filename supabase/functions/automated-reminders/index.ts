import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

type ReminderTaskRow = {
  id: string;
  title: string;
  due_at: string;
  status: string;
  notes: string | null;
  lead_id: string;
  assigned_agent_id: string | null;
  reminder_enabled: boolean;
  reminder_sent_at: string | null;
};

export {};
declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const smtpUser = Deno.env.get("SMTP_GMAIL_USER");
    const smtpPass = Deno.env.get("SMTP_GMAIL_APP_PASSWORD");
    const emailFrom = Deno.env.get("REMINDER_EMAIL_FROM") ?? smtpUser ?? "no-reply@example.com";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables.");
    }
    if (!smtpUser || !smtpPass) {
      throw new Error("Missing SMTP_GMAIL_USER or SMTP_GMAIL_APP_PASSWORD.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: settings } = await supabase
      .from("crm_settings")
      .select("reminder_email_enabled, daily_reminder_hour, company_name")
      .eq("id", true)
      .maybeSingle<{ reminder_email_enabled: boolean; daily_reminder_hour: number; company_name: string }>();

    if (!settings?.reminder_email_enabled) {
      return jsonResponse({ success: true, message: "Reminder emails disabled in settings.", sent: 0 });
    }

    const now = new Date();
    const next24h = new Date(now);
    next24h.setHours(next24h.getHours() + 24);

    const { data: tasks, error: tasksError } = await supabase
      .from("follow_up_tasks")
      .select("id,title,due_at,status,notes,lead_id,assigned_agent_id,reminder_enabled,reminder_sent_at")
      .eq("status", "pending")
      .eq("reminder_enabled", true)
      .is("reminder_sent_at", null)
      .lte("due_at", next24h.toISOString())
      .returns<ReminderTaskRow[]>();

    if (tasksError) throw tasksError;
    if (!tasks || tasks.length === 0) {
      return jsonResponse({ success: true, message: "No pending reminders.", sent: 0 });
    }

    const leadIds = [...new Set(tasks.map((task) => task.lead_id))];
    const agentIds = [...new Set(tasks.map((task) => task.assigned_agent_id).filter(Boolean))] as string[];

    const [{ data: leads }, { data: agents }] = await Promise.all([
      supabase.from("leads").select("id,full_name").in("id", leadIds),
      agentIds.length > 0
        ? supabase.from("profiles").select("id,email").in("id", agentIds)
        : Promise.resolve({ data: [] as Array<{ id: string; email: string }> }),
    ]);

    const leadNameById = new Map((leads ?? []).map((lead) => [lead.id, lead.full_name]));
    const agentEmailById = new Map((agents ?? []).map((agent) => [agent.id, agent.email]));

    const smtpClient = new SmtpClient();
    await smtpClient.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: smtpUser,
      password: smtpPass,
    });

    let sentCount = 0;
    for (const task of tasks) {
      const to = task.assigned_agent_id ? agentEmailById.get(task.assigned_agent_id) : null;
      if (!to) continue;

      const leadName = leadNameById.get(task.lead_id) ?? "Unknown lead";
      const dueAt = new Date(task.due_at).toLocaleString();
      const overdueLabel = new Date(task.due_at) < now ? "OVERDUE" : "Due soon";

      try {
        await smtpClient.send({
          from: emailFrom,
          to,
          subject: `[${settings.company_name}] Follow-up reminder: ${task.title}`,
          content: `
Follow-up Reminder
Status: ${overdueLabel}
Task: ${task.title}
Lead: ${leadName}
Due: ${dueAt}
Notes: ${task.notes ?? "-"}
          `.trim(),
        });
      } catch {
        continue;
      }

      await supabase
        .from("follow_up_tasks")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", task.id);

      sentCount += 1;
    }

    await smtpClient.close();
    return jsonResponse({ success: true, sent: sentCount, scanned: tasks.length });
  } catch (error) {
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Unknown error." },
      500,
    );
  }
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
