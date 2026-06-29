"use client";

import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";
import { requireAdmin } from "@/lib/auth/guards";
import type { AppNotification } from "@/lib/auth/types";
import { appRedirect } from "@/lib/navigation";
import { createDataClient } from "@/lib/supabase/client";

async function loadPageData() {
  const { profile } = await requireAdmin();
  const adminClient = createDataClient();

  const { data: notifications } = await adminClient
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

export default function AdminNotificationsPage() {
  const { data, loading, reload } = usePageLoader(() => loadPageData(), []);

  async function markAllAdminNotificationsReadAction() {
    const { profile } = await requireAdmin();
    const adminClient = createDataClient();
    await adminClient
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", profile.id)
      .eq("is_read", false);
    reload();
    appRedirect("/admin/notifications");
  }

  async function markSingleAdminNotificationReadAction(formData: FormData) {
    const { profile } = await requireAdmin();
    const adminClient = createDataClient();
    const notificationId = String(formData.get("notification_id") ?? "");
    if (!notificationId) {
      appRedirect("/admin/notifications");
      return;
    }

    await adminClient
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", profile.id);

    reload();
    appRedirect("/admin/notifications");
  }

  if (loading || !data) return <PageLoadingState />;

  const { items, unreadCount } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl tracking-tight text-[#1A1A1A]">Notifications</h1>
          <p className="text-sm text-gray-600">
            {unreadCount} unread of {items.length}
          </p>
        </div>
        <form action={markAllAdminNotificationsReadAction}>
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
                  <form action={markSingleAdminNotificationReadAction}>
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
    </div>
  );
}
