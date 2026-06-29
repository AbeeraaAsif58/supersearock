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
        "Scheduled summary edge function is reserved for future phase. Core dashboard/reports already provide live and periodic visibility.",
      todo: [
        "Daily summary email to admin",
        "Weekly agent performance digest",
        "Pipeline movement summary by stage",
      ],
    }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
