"use client";

import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { requireActiveAgent, requireAgent } from "@/lib/auth/guards";
import type { Profile } from "@/lib/auth/types";
import { createDataClient, createClient } from "@/lib/supabase/client";
import { appRedirect } from "@/lib/navigation";
import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";

type SettingsPageData = {
  profile: Profile;
  unreadNotificationsCount: number;
  currentFullName: string;
};

async function loadSettingsPageData(): Promise<SettingsPageData> {
  const { profile } = await requireAgent();
  const dataClient = createDataClient();

  const supabase = createClient();
  const [{ data: authData }, { count: unreadNotificationsCountRaw }] = await Promise.all([
    supabase.auth.getUser(),
    dataClient
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false),
  ]);

  const currentFullName =
    typeof authData.user?.user_metadata?.full_name === "string"
      ? authData.user.user_metadata.full_name
      : "";

  return {
    profile,
    unreadNotificationsCount: unreadNotificationsCountRaw ?? 0,
    currentFullName,
  };
}

async function updateAgentProfileAction(formData: FormData) {
  await requireActiveAgent();
  const supabase = createClient();
  const fullName = String(formData.get("full_name") ?? "").trim();

  const { error } = await supabase.auth.updateUser({
    data: { full_name: fullName || null },
  });

  if (error) {
    appRedirect(`/dashboard/settings?error=${encodeURIComponent(error.message)}`);
    return;
  }

  appRedirect("/dashboard/settings?message=Profile%20updated%20successfully.");
}

async function updateAgentPasswordAction(formData: FormData) {
  await requireActiveAgent();
  const supabase = createClient();
  const newPassword = String(formData.get("new_password") ?? "");

  if (newPassword.length < 8) {
    appRedirect("/dashboard/settings?error=Password%20must%20be%20at%20least%208%20characters.");
    return;
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    appRedirect(`/dashboard/settings?error=${encodeURIComponent(error.message)}`);
    return;
  }

  appRedirect("/dashboard/settings?message=Password%20updated%20successfully.");
}

async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  appRedirect("/login");
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
      <p className="text-xs uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#1A1A1A] break-all">{value}</p>
    </div>
  );
}

export default function AgentSettingsPage() {
  const [searchParams] = useSearchParams();
  const message = searchParams.get("message") ? decodeURIComponent(searchParams.get("message")!) : undefined;
  const error = searchParams.get("error") ? decodeURIComponent(searchParams.get("error")!) : undefined;
  const { data, loading, error: loadError } = usePageLoader(loadSettingsPageData, []);

  if (loading) return <PageLoadingState />;
  if (loadError || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-red-600">
        {loadError ?? "Failed to load settings."}
      </div>
    );
  }

  const { profile, unreadNotificationsCount, currentFullName } = data;

  return (
    <main className="min-h-screen bg-[#F4F1ED] p-2 md:p-3">
      <div className="mx-auto grid w-full max-w-[98vw] grid-cols-1 gap-3 lg:grid-cols-[300px_1fr]">
        <aside className="sticky top-2 md:top-3 h-[calc(100vh-1rem)] md:h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl border border-[#E0DDD9] bg-white/70 p-5 md:p-6">
          <div className="border-b border-[#EAE7E2] pb-4">
            <p className="text-xs uppercase tracking-[0.25em] text-[#E55B3C]">Super Sea Rock Real Estate</p>
            <h2 className="mt-2 text-xl tracking-tight text-[#1A1A1A]">Agent Workspace</h2>
          </div>

          <nav className="mt-5 space-y-1.5">
            <Link to="/dashboard" className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]">
              Dashboard
            </Link>
            <Link to="/dashboard/leads" className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]">
              My Leads
            </Link>
            <Link to="/dashboard/follow-ups" className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]">
              Follow-ups
            </Link>
            <Link
              to="/dashboard/notifications"
              className="flex items-center justify-between rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]"
            >
              <span>Notifications</span>
              {unreadNotificationsCount > 0 && (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#E55B3C]/10 px-2 py-0.5 text-xs font-semibold text-[#E55B3C]">
                  {unreadNotificationsCount}
                </span>
              )}
            </Link>
            <Link to="/dashboard/settings" className="block rounded-xl bg-[#E55B3C] px-3.5 py-3 text-base text-white">
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

        <section className="rounded-2xl border border-[#E0DDD9] bg-white/70 p-5 md:p-7 space-y-4">
          <div>
            <h1 className="text-3xl tracking-tight text-[#1A1A1A]">Settings</h1>
            <p className="text-sm text-gray-600">Manage your basic account settings.</p>
            {message && <p className="mt-1 text-sm text-green-700">{message}</p>}
            {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
          </div>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Account Info</CardTitle>
              <CardDescription>Read-only profile details for your current session.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <InfoTile label="Email" value={profile.email} />
              <InfoTile label="Role" value={profile.role} />
              <InfoTile label="Status" value={profile.status} />
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your display name used across auth metadata.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateAgentProfileAction} className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                <Input
                  name="full_name"
                  defaultValue={currentFullName}
                  placeholder="Full name"
                  className="h-10 rounded-lg md:col-span-2"
                />
                <AdminFormSubmitButton
                  idleText="Save profile"
                  pendingText="Saving..."
                  className="h-10 rounded-lg bg-[#E55B3C] text-white hover:bg-[#c94b2f]"
                />
              </form>
            </CardContent>
          </Card>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Change your login password.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateAgentPasswordAction} className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                <Input
                  name="new_password"
                  type="password"
                  minLength={8}
                  required
                  placeholder="New password (min 8 chars)"
                  className="h-10 rounded-lg md:col-span-2"
                />
                <AdminFormSubmitButton
                  idleText="Update password"
                  pendingText="Updating..."
                  className="h-10 rounded-lg bg-[#E55B3C] text-white hover:bg-[#c94b2f]"
                />
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
