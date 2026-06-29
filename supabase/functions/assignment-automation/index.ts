const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export {};
declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: false,
      message:
        "Assignment automation edge function is reserved for future phase. Use /admin/distribution actions for now.",
      todo: [
        "Run rule assignment by cron",
        "Run round-robin on eligible leads by settings",
        "Write assignment logs and notifications",
      ],
    }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
