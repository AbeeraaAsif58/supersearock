import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const user = Deno.env.get("SMTP_GMAIL_USER");
    const pass = Deno.env.get("SMTP_GMAIL_APP_PASSWORD");
    const fromAddress = Deno.env.get("REMINDER_EMAIL_FROM") ?? user;

    if (!user || !pass || !fromAddress) {
      return json({ sent: false, reason: "missing_smtp_config" });
    }

    const body = await req.json();
    const { subject, text, html, to } = buildEmail(body);

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: user, password: pass },
      },
    });

    await client.send({
      from: `"Super Sea Rock Real Estate" <${fromAddress}>`,
      to,
      subject,
      content: text,
      html,
    });
    await client.close();

    return json({ sent: true });
  } catch (error) {
    return json({ sent: false, error: error instanceof Error ? error.message : "send failed" }, 500);
  }
});

function buildEmail(body: Record<string, unknown>) {
  const type = String(body.type ?? "");

  if (type === "lead-assignment") {
    const lead = body.lead as Record<string, unknown>;
    const agentEmail = String(body.agentEmail);
    const assignedByEmail = String(body.assignedByEmail);
    const fullName = String(lead.fullName);
    const subject = `New lead assigned: ${fullName}`;
    const text = `A new lead has been assigned to you.\n\nLead: ${fullName}\nAssigned by: ${assignedByEmail}`;
    return { to: agentEmail, subject, text, html: `<p>${text.replaceAll("\n", "<br/>")}</p>` };
  }

  if (type === "bulk-lead-assignment") {
    const agentEmail = String(body.agentEmail);
    const leadsCount = Number(body.leadsCount);
    const subject = `${leadsCount} new leads assigned to you`;
    const text = `You have ${leadsCount} new leads assigned from a bulk upload.`;
    return { to: agentEmail, subject, text, html: `<p>${text}</p>` };
  }

  if (type === "round-robin-summary") {
    const agentEmail = String(body.agentEmail);
    const totalLeads = Number(body.totalLeads);
    const subject = `Round-robin: ${totalLeads} leads assigned`;
    const text = `You have been assigned ${totalLeads} leads via round-robin.`;
    return { to: agentEmail, subject, text, html: `<p>${text}</p>` };
  }

  if (type === "manual-follow-up") {
    const to = String(body.to);
    const subject = String(body.subject ?? "Follow-up reminder");
    const text = String(body.text ?? "");
    return { to, subject, text, html: `<p>${text.replaceAll("\n", "<br/>")}</p>` };
  }

  throw new Error("Unknown email type");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
