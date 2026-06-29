import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/auth/types";
import { appRedirect } from "@/lib/navigation";

export async function getCurrentSessionWithProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,role,status,is_primary_admin,created_at,updated_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { user, profile: profile ?? null };
}

export async function requireAuthenticated() {
  const { user, profile } = await getCurrentSessionWithProfile();

  if (!user || !profile) {
    appRedirect("/login");
    throw new Error("UNAUTHENTICATED");
  }

  if (profile.status === "blocked") {
    const supabase = createClient();
    await supabase.auth.signOut();
    appRedirect("/login?error=Account%20is%20blocked.%20Contact%20admin.");
    throw new Error("BLOCKED");
  }

  return { user, profile };
}

export async function requireAdmin() {
  const { user, profile } = await requireAuthenticated();

  if (profile.role !== "admin" || !profile.is_primary_admin) {
    appRedirect("/dashboard?error=Admin%20access%20required.");
    throw new Error("FORBIDDEN");
  }

  return { user, profile };
}

export async function requireAgent() {
  const { user, profile } = await requireAuthenticated();

  if (profile.role !== "agent") {
    if (profile.role === "admin" && profile.is_primary_admin) {
      appRedirect("/admin/dashboard");
      throw new Error("REDIRECT_ADMIN");
    }
    appRedirect("/dashboard?error=Agent%20access%20required.");
    throw new Error("FORBIDDEN");
  }

  return { user, profile };
}

export async function requireActiveAgent() {
  const { user, profile } = await requireAgent();

  if (profile.status === "readonly") {
    appRedirect(
      "/dashboard?error=Account%20is%20read-only.%20You%20can%20view%20data%20but%20cannot%20make%20changes.",
    );
    throw new Error("READONLY");
  }

  return { user, profile };
}

/** For page data loaders — throws without redirecting (route guards handle navigation). */
export async function assertAuthenticated() {
  const { user, profile } = await getCurrentSessionWithProfile();
  if (!user || !profile) throw new Error("Not authenticated.");
  if (profile.status === "blocked") throw new Error("Account is blocked.");
  return { user, profile };
}

export async function assertAdmin() {
  const session = await assertAuthenticated();
  if (session.profile.role !== "admin" || !session.profile.is_primary_admin) {
    throw new Error("Admin access required.");
  }
  return session;
}

export async function assertAgent() {
  const session = await assertAuthenticated();
  if (session.profile.role !== "agent") throw new Error("Agent access required.");
  return session;
}

export async function assertActiveAgent() {
  const session = await assertAgent();
  if (session.profile.status === "readonly") throw new Error("Account is read-only.");
  return session;
}
