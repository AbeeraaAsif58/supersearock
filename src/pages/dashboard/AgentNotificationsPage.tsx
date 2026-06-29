"use client";

import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { requireActiveAgent, requireAgent } from "@/lib/auth/guards";
import type { AppNotification, Profile } from "@/lib/auth/types";
import { AgentRealtimeRefresh } from "@/components/agent/agent-realtime-refresh";
import { createDataClient, createClient } from "@/lib/supabase/client";
import { appRedirect } from "@/lib/navigation";
import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";

type NotificationsPageData = {
  profile: Profile;
  items: AppNotification[];
  unreadCount: number;
};

async function loadNotificationsPageData(): Promise<NotificationsPageData> {
  const { profile } = await requireAgent();
  const dataClient = createDataClient();

  const { data: notifications } = await dataClient
    .from("notifications")
    .select("id,user_id,title,message,notification_type,entity_type,entity_id,is_read,read_at,created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(80)
    .returns<AppNotification[]>();

  const items = notifications ?? [];
  const unreadCount = items.filter((item) => !item.is_read).length;

  return { profile, items, unreadCount };
}

async function markAllAgentNotificationsReadAction() {
  const { profile } = await requireActiveAgent();
  const dataClient = createDataClient();
  await dataClient
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .eq("is_read", false);
  appRedirect("/dashboard/notifications");
}

async function markSingleAgentNotificationReadAction(formData: FormData) {
  const { profile } = await requireActiveAgent();
  const dataClient = createDataClient();
  const notificationId = String(formData.get("notification_id") ?? "");
  if (!notificationId) {
    appRedirect("/dashboard/notifications");
    return;
  }

  await dataClient
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", profile.id);

  appRedirect("/dashboard/notifications");
}

async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  appRedirect("/login");
}

export default function AgentNotificationsPage() {
  const { data, loading, error: loadError, reload } = usePageLoader(loadNotificationsPageData, []);

  if (loading) return <PageLoadingState />;
  if (loadError || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-red-600">
        {loadError ?? "Failed to load notifications."}
      </div>
    );
  }

  const { profile, items, unreadCount } = data;

  return (
    <main className="min-h-screen bg-[#F4F1ED] p-2 md:p-3">
      <AgentRealtimeRefresh agentId={profile.id} onRefresh={reload} />
      <div className="mx-auto grid w-full max-w-[98vw] grid-cols-1 gap-3 lg:grid-cols-[300px_1fr]">
        <aside className="sticky top-2 md:top-3 h-[calc(100vh-1rem)] md:h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl border border-[#E0DDD9] bg-white/70 p-5 md:p-6">
          <div className="border-b border-[#EAE7E2] pb-4">
            <p className="text-xs uppercase tracking-[0.25em] text-[#E55B3C]">Super Sea Rock Real Estate</p>
            <h2 className="mt-2 text-xl tracking-tight text-[#1A1A1A]">Agent Workspace</h2>
          </div>
          <nav className="mt-5 space-y-1.5">
            <Link to="/dashboard" className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]">Dashboard</Link>
            <Link to="/dashboard/leads" className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]">My Leads</Link>
            <Link to="/dashboard/follow-ups" className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]">Follow-ups</Link>
            <Link to="/dashboard/notifications" className="flex items-center justify-between rounded-xl bg-[#E55B3C] px-3.5 py-3 text-base text-white">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
            <Link to="/dashboard/settings" className="block rounded-xl px-3.5 py-3 text-base text-[#1A1A1A] hover:bg-[#F4F1ED]">Settings</Link>
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
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl tracking-tight text-[#1A1A1A]">Notifications</h1>
              <p className="text-sm text-gray-600">
                {unreadCount} unread of {items.length}
              </p>
            </div>
            <form action={markAllAgentNotificationsReadAction}>
              <AdminFormSubmitButton
                idleText="Mark all read"
                pendingText="Marking..."
                variant="outline"
                className="rounded-md border border-[#E0DDD9] px-3 py-1.5 text-xs text-[#1A1A1A] hover:bg-[#F4F1ED]"
              />
            </form>
          </div>

          <Card className="border-[#E0DDD9] bg-white">
            <CardHeader>
              <CardTitle>All Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {items.length === 0 && <p className="text-sm text-gray-500">No notifications yet.</p>}
              {items.map((item) => (
                <div key={item.id} className={`rounded-lg border p-3 ${item.is_read ? "border-[#EAE7E2] bg-[#FAF9F7]" : "border-[#FAD7CE] bg-[#FFF5F2]"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1A]">{item.title}</p>
                      <p className="mt-1 text-xs text-gray-600">{item.message}</p>
                      <p className="mt-1 text-[11px] text-gray-500">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    {!item.is_read && (
                      <form action={markSingleAgentNotificationReadAction}>
                        <input type="hidden" name="notification_id" value={item.id} />
                        <AdminFormSubmitButton
                          idleText="Mark read"
                          pendingText="Marking..."
                          variant="outline"
                          className="rounded-md border border-[#E0DDD9] px-2 py-1 text-[11px] text-[#1A1A1A] hover:bg-[#F4F1ED]"
                        />
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
