"use client";

import { useSearchParams } from "react-router-dom";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";
import { requireAdmin } from "@/lib/auth/guards";
import type { CrmSettings } from "@/lib/auth/types";
import { appRedirect } from "@/lib/navigation";
import { createDataClient } from "@/lib/supabase/client";

async function getOrCreateSettings(userId: string): Promise<CrmSettings> {
  const adminClient = createDataClient();
  const { data } = await adminClient
    .from("crm_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle<CrmSettings>();

  if (data) {
    return data;
  }

  const insertPayload = {
    id: true,
    updated_by: userId,
  };
  const { data: inserted, error } = await adminClient
    .from("crm_settings")
    .insert(insertPayload)
    .select("*")
    .single<CrmSettings>();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Unable to initialize CRM settings.");
  }
  return inserted;
}

async function loadPageData() {
  const { profile } = await requireAdmin();
  const settings = await getOrCreateSettings(profile.id);
  return { settings };
}

export default function AdminSettingsPage() {
  const [searchParams] = useSearchParams();
  const { data, loading, reload } = usePageLoader(() => loadPageData(), [searchParams.toString()]);

  async function updateCompanySettingsAction(formData: FormData) {
    const { profile } = await requireAdmin();
    const adminClient = createDataClient();
    const companyName = String(formData.get("company_name") ?? "").trim();

    if (!companyName) {
      appRedirect("/admin/settings?error=Company%20name%20is%20required.");
      return;
    }

    const { error } = await adminClient
      .from("crm_settings")
      .upsert(
        {
          id: true,
          company_name: companyName,
          company_email: normalizeOptional(String(formData.get("company_email") ?? "")),
          company_phone: normalizeOptional(String(formData.get("company_phone") ?? "")),
          timezone: String(formData.get("timezone") ?? "Asia/Karachi").trim() || "Asia/Karachi",
          address: normalizeOptional(String(formData.get("address") ?? "")),
          logo_url: normalizeOptional(String(formData.get("logo_url") ?? "")),
          updated_by: profile.id,
        },
        { onConflict: "id" },
      );

    if (error) {
      appRedirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
      return;
    }
    reload();
    appRedirect("/admin/settings?message=Company%20settings%20saved.");
  }

  async function updateDistributionSettingsAction(formData: FormData) {
    const { profile } = await requireAdmin();
    const adminClient = createDataClient();

    const { error } = await adminClient
      .from("crm_settings")
      .upsert(
        {
          id: true,
          round_robin_enabled: formData.get("round_robin_enabled") === "on",
          auto_assign_on_lead_create: formData.get("auto_assign_on_lead_create") === "on",
          default_assignment_mode: String(formData.get("default_assignment_mode") ?? "manual"),
          updated_by: profile.id,
        },
        { onConflict: "id" },
      );

    if (error) {
      appRedirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
      return;
    }
    reload();
    appRedirect("/admin/settings?message=Distribution%20settings%20saved.");
  }

  async function updateReminderSettingsAction(formData: FormData) {
    const { profile } = await requireAdmin();
    const adminClient = createDataClient();
    const reminderHour = Number(String(formData.get("daily_reminder_hour") ?? "9"));
    if (!Number.isFinite(reminderHour) || reminderHour < 0 || reminderHour > 23) {
      appRedirect("/admin/settings?error=Daily%20reminder%20hour%20must%20be%20between%200%20and%2023.");
      return;
    }

    const { error } = await adminClient
      .from("crm_settings")
      .upsert(
        {
          id: true,
          daily_reminder_hour: reminderHour,
          overdue_alerts_enabled: formData.get("overdue_alerts_enabled") === "on",
          reminder_email_enabled: formData.get("reminder_email_enabled") === "on",
          reminder_in_app_enabled: formData.get("reminder_in_app_enabled") === "on",
          reminder_whatsapp_enabled: formData.get("reminder_whatsapp_enabled") === "on",
          updated_by: profile.id,
        },
        { onConflict: "id" },
      );

    if (error) {
      appRedirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
      return;
    }
    reload();
    appRedirect("/admin/settings?message=Reminder%20settings%20saved.");
  }

  async function updateSecuritySettingsAction(formData: FormData) {
    const { profile } = await requireAdmin();
    const adminClient = createDataClient();

    const sessionTimeout = Number(String(formData.get("session_timeout_minutes") ?? "120"));
    const passwordRotation = Number(String(formData.get("password_rotation_days") ?? "90"));
    if (!Number.isFinite(sessionTimeout) || sessionTimeout < 15 || sessionTimeout > 1440) {
      appRedirect("/admin/settings?error=Session%20timeout%20must%20be%20between%2015%20and%201440%20minutes.");
      return;
    }
    if (!Number.isFinite(passwordRotation) || passwordRotation < 30 || passwordRotation > 365) {
      appRedirect("/admin/settings?error=Password%20rotation%20must%20be%20between%2030%20and%20365%20days.");
      return;
    }

    const { error } = await adminClient
      .from("crm_settings")
      .upsert(
        {
          id: true,
          session_timeout_minutes: sessionTimeout,
          password_rotation_days: passwordRotation,
          enforce_strong_password: formData.get("enforce_strong_password") === "on",
          updated_by: profile.id,
        },
        { onConflict: "id" },
      );

    if (error) {
      appRedirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
      return;
    }
    reload();
    appRedirect("/admin/settings?message=Security%20settings%20saved.");
  }

  async function updateAgentQualitySettingsAction(formData: FormData) {
    const { profile } = await requireAdmin();
    const adminClient = createDataClient();
    const slaHours = Number(String(formData.get("sla_follow_up_delay_hours") ?? "24"));
    if (!Number.isFinite(slaHours) || slaHours < 1 || slaHours > 168) {
      appRedirect("/admin/settings?error=SLA%20delay%20threshold%20must%20be%20between%201%20and%20168%20hours.");
      return;
    }

    const { error } = await adminClient
      .from("crm_settings")
      .upsert(
        {
          id: true,
          mandatory_transition_notes: formData.get("mandatory_transition_notes") === "on",
          close_lost_requires_activity: formData.get("close_lost_requires_activity") === "on",
          sla_follow_up_delay_hours: slaHours,
          updated_by: profile.id,
        },
        { onConflict: "id" },
      );

    if (error) {
      appRedirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
      return;
    }
    reload();
    appRedirect("/admin/settings?message=Agent%20quality%20settings%20saved.");
  }

  if (loading || !data) return <PageLoadingState />;

  const { settings } = data;
  const message = searchParams.get("message") ? decodeURIComponent(searchParams.get("message")!) : undefined;
  const error = searchParams.get("error") ? decodeURIComponent(searchParams.get("error")!) : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl tracking-tight text-[#1A1A1A]">Settings</h1>
        <p className="text-sm text-gray-600">
          Manage company profile, distribution defaults, reminders, and security controls.
        </p>
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateCompanySettingsAction} className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <Input name="company_name" defaultValue={settings.company_name} className="h-10 rounded-lg" placeholder="Company name" required />
            <Input name="company_email" defaultValue={settings.company_email ?? ""} className="h-10 rounded-lg" placeholder="Company email" />
            <Input name="company_phone" defaultValue={settings.company_phone ?? ""} className="h-10 rounded-lg" placeholder="Company phone" />
            <Input name="timezone" defaultValue={settings.timezone} className="h-10 rounded-lg" placeholder="Timezone (e.g. Asia/Karachi)" required />
            <Input name="logo_url" defaultValue={settings.logo_url ?? ""} className="h-10 rounded-lg md:col-span-2" placeholder="Logo URL (optional)" />
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs uppercase tracking-widest text-gray-500">Office Address</label>
              <textarea
                name="address"
                defaultValue={settings.address ?? ""}
                className="min-h-[96px] w-full rounded-lg border border-[#CEC8BF] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[#E55B3C]/25"
                placeholder="Company address"
              />
            </div>
            <AdminFormSubmitButton
              idleText="Save Company Settings"
              pendingText="Saving..."
              className="h-10 rounded-lg bg-[#E55B3C] hover:bg-[#c94b2f] md:w-fit"
            />
          </form>
        </CardContent>
      </Card>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Distribution Defaults</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateDistributionSettingsAction} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input name="round_robin_enabled" type="checkbox" defaultChecked={settings.round_robin_enabled} className="h-4 w-4" />
              Enable round-robin automation
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input name="auto_assign_on_lead_create" type="checkbox" defaultChecked={settings.auto_assign_on_lead_create} className="h-4 w-4" />
              Auto-assign when lead is created
            </label>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-gray-500">Default Assignment Mode</label>
              <select
                name="default_assignment_mode"
                defaultValue={settings.default_assignment_mode}
                className="h-10 w-full rounded-lg border border-[#CEC8BF] bg-white px-3 text-sm"
              >
                <option value="manual">Manual</option>
                <option value="round_robin">Round Robin</option>
                <option value="rules">Area/Source Rules</option>
              </select>
            </div>
            <div className="flex items-end">
              <AdminFormSubmitButton
                idleText="Save Distribution Settings"
                pendingText="Saving..."
                className="h-10 rounded-lg bg-[#E55B3C] hover:bg-[#c94b2f]"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Reminders and Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateReminderSettingsAction} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-gray-500">Daily Reminder Hour (0-23)</label>
              <Input
                name="daily_reminder_hour"
                type="number"
                min={0}
                max={23}
                defaultValue={String(settings.daily_reminder_hour)}
                className="h-10 rounded-lg"
                required
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input name="overdue_alerts_enabled" type="checkbox" defaultChecked={settings.overdue_alerts_enabled} className="h-4 w-4" />
              Enable overdue alerts
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input name="reminder_email_enabled" type="checkbox" defaultChecked={settings.reminder_email_enabled} className="h-4 w-4" />
              Send reminder via email
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input name="reminder_in_app_enabled" type="checkbox" defaultChecked={settings.reminder_in_app_enabled} className="h-4 w-4" />
              Send reminder via in-app notifications
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input name="reminder_whatsapp_enabled" type="checkbox" defaultChecked={settings.reminder_whatsapp_enabled} className="h-4 w-4" />
              Send reminder via WhatsApp (future integration)
            </label>
            <div className="md:col-span-2">
              <AdminFormSubmitButton
                idleText="Save Reminder Settings"
                pendingText="Saving..."
                className="h-10 rounded-lg bg-[#E55B3C] hover:bg-[#c94b2f]"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Security Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateSecuritySettingsAction} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-gray-500">Session Timeout (minutes)</label>
              <Input
                name="session_timeout_minutes"
                type="number"
                min={15}
                max={1440}
                defaultValue={String(settings.session_timeout_minutes)}
                className="h-10 rounded-lg"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-gray-500">Password Rotation (days)</label>
              <Input
                name="password_rotation_days"
                type="number"
                min={30}
                max={365}
                defaultValue={String(settings.password_rotation_days)}
                className="h-10 rounded-lg"
                required
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
              <input name="enforce_strong_password" type="checkbox" defaultChecked={settings.enforce_strong_password} className="h-4 w-4" />
              Enforce strong password policy for users
            </label>
            <div className="md:col-span-2">
              <AdminFormSubmitButton
                idleText="Save Security Settings"
                pendingText="Saving..."
                className="h-10 rounded-lg bg-[#E55B3C] hover:bg-[#c94b2f]"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Agent Quality and SLA Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateAgentQualitySettingsAction} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input name="mandatory_transition_notes" type="checkbox" defaultChecked={settings.mandatory_transition_notes} className="h-4 w-4" />
              Mandatory note on status transitions
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input name="close_lost_requires_activity" type="checkbox" defaultChecked={settings.close_lost_requires_activity} className="h-4 w-4" />
              Require activity before closed/lost
            </label>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-gray-500">SLA Delay Threshold (hours)</label>
              <Input
                name="sla_follow_up_delay_hours"
                type="number"
                min={1}
                max={168}
                defaultValue={String(settings.sla_follow_up_delay_hours)}
                className="h-10 rounded-lg"
                required
              />
            </div>
            <div className="flex items-end">
              <AdminFormSubmitButton
                idleText="Save Agent Quality Settings"
                pendingText="Saving..."
                className="h-10 rounded-lg bg-[#E55B3C] hover:bg-[#c94b2f]"
              />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
