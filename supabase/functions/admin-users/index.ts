import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdminUsersPayload =
  | { action: "invite"; email: string; name: string | null; redirectTo: string }
  | { action: "update"; userId: string; payload: Record<string, unknown> }
  | { action: "delete"; userId: string }
  | { action: "get"; userId: string };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role,is_primary_admin,status")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin" || !profile.is_primary_admin || profile.status === "blocked") {
      return json({ error: "Forbidden" }, 403);
    }

    const body = (await req.json()) as AdminUsersPayload;

    if (body.action === "invite") {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(body.email, {
        redirectTo: body.redirectTo,
        data: { full_name: body.name || null },
      });
      if (error || !data.user) return json({ error: error?.message ?? "Invite failed" }, 400);
      return json({ userId: data.user.id });
    }

    if (body.action === "update") {
      const { error } = await adminClient.auth.admin.updateUserById(body.userId, body.payload);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (body.action === "delete") {
      const { error } = await adminClient.auth.admin.deleteUser(body.userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (body.action === "get") {
      const { data, error } = await adminClient.auth.admin.getUserById(body.userId);
      if (error || !data.user) return json({ error: error?.message ?? "User not found" }, 404);
      return json({ user: data.user });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
