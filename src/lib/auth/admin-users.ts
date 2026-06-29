import { invokeEdgeFunction } from "@/lib/supabase/functions";
import { getSiteUrl } from "@/lib/config/url";

export async function inviteAgentByEmail(email: string, name: string | null) {
  return invokeEdgeFunction<{ userId: string }>("admin-users", {
    action: "invite",
    email,
    name,
    redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });
}

export async function updateAuthUserById(
  userId: string,
  payload: { password?: string; email?: string; ban_duration?: string },
) {
  return invokeEdgeFunction("admin-users", {
    action: "update",
    userId,
    payload,
  });
}

export async function deleteAuthUser(userId: string) {
  return invokeEdgeFunction("admin-users", {
    action: "delete",
    userId,
  });
}

export async function getAuthUserById(userId: string) {
  return invokeEdgeFunction<{ user: { email?: string; last_sign_in_at?: string } }>("admin-users", {
    action: "get",
    userId,
  });
}
