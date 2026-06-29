"use client";

import { usePageLoader, PageLoadingState } from "@/hooks/use-page-loader";
import { requireAdmin } from "@/lib/auth/guards";
import type { LeadStatus, Profile } from "@/lib/auth/types";
import { createDataClient } from "@/lib/supabase/client";

const pipelineStages: LeadStatus[] = [
  "new",
  "assigned",
  "follow_up",
  "interested",
  "call_denied",
  "closed",
  "lost",
];

async function loadPageData() {
  await requireAdmin();
  const adminClient = createDataClient();
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [statusCountsRes, agentsRes, agentSummaryRes, totalLeadsRes, weeklyLeadsRes, monthlyLeadsRes] = await Promise.all([
    adminClient.rpc("get_lead_status_counts"),
    adminClient
      .from("profiles")
      .select("id,email,role,status,is_primary_admin,created_at,updated_at")
      .eq("role", "agent")
      .returns<Profile[]>(),
    adminClient.rpc("get_agent_performance_summary"),
    adminClient
      .from("leads")
      .select("id", { count: "exact", head: true }),
    adminClient
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString()),
    adminClient
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthAgo.toISOString()),
  ]);

  const agents = agentsRes.data ?? [];
  const weeklyLeads = weeklyLeadsRes.count ?? 0;
  const monthlyLeads = monthlyLeadsRes.count ?? 0;
  const totalLeads = totalLeadsRes.count ?? 0;

  const statusCounts = Object.fromEntries(pipelineStages.map((stage) => [stage, 0])) as Record<LeadStatus, number>;
  for (const row of (statusCountsRes.data ?? []) as Array<{ status: LeadStatus; total: number | string }>) {
    statusCounts[row.status] = Number(row.total ?? 0);
  }

  const closed = statusCounts.closed;
  const lost = statusCounts.lost;
  const conversionRate = totalLeads > 0 ? Math.round((closed / totalLeads) * 100) : 0;
  const lossRate = totalLeads > 0 ? Math.round((lost / totalLeads) * 100) : 0;

  const agentSummaryById = new Map(
    ((agentSummaryRes.data ?? []) as Array<{ agent_id: string; assigned: number | string; closed: number | string; completed_follow_ups: number | string }>).map((row) => [
      row.agent_id,
      {
        assigned: Number(row.assigned ?? 0),
        closed: Number(row.closed ?? 0),
        completedFollowUps: Number(row.completed_follow_ups ?? 0),
      },
    ]),
  );

  const agentRows = agents
    .map((agent) => {
      const summary = agentSummaryById.get(agent.id);
      const assigned = summary?.assigned ?? 0;
      const completedFollowUps = summary?.completedFollowUps ?? 0;
      const closedByThisAgent = summary?.closed ?? 0;
      const agentConversionRate = assigned > 0 ? Math.round((closedByThisAgent / assigned) * 100) : 0;
      return {
        id: agent.id,
        email: agent.email,
        assigned,
        completedFollowUps,
        closed: closedByThisAgent,
        conversionRate: agentConversionRate,
      };
    })
    .sort((a, b) => b.assigned - a.assigned);

  const maxStatusCount = Math.max(1, ...pipelineStages.map((status) => statusCounts[status]));

  return {
    totalLeads,
    weeklyLeads,
    monthlyLeads,
    conversionRate,
    lossRate,
    closed,
    lost,
    statusCounts,
    agentRows,
    maxStatusCount,
  };
}

export default function AdminReportsPage() {
  const { data, loading } = usePageLoader(() => loadPageData(), []);

  if (loading || !data) return <PageLoadingState />;

  const {
    totalLeads,
    weeklyLeads,
    monthlyLeads,
    conversionRate,
    lossRate,
    closed,
    lost,
    statusCounts,
    agentRows,
    maxStatusCount,
  } = data;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl tracking-tight text-[#1A1A1A]">Reports</h1>
      <p className="text-sm text-gray-600">KPI cards, status breakdown, agent performance, and pipeline analytics.</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Leads" value={String(totalLeads)} />
        <KpiCard label="Weekly Leads" value={String(weeklyLeads)} />
        <KpiCard label="Monthly Leads" value={String(monthlyLeads)} />
        <KpiCard label="Conversion Rate" value={`${conversionRate}%`} />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-[#E0DDD9] bg-white p-5">
          <h2 className="text-lg font-medium text-[#1A1A1A]">Lead Status Breakdown</h2>
          <div className="mt-4 space-y-3">
            {pipelineStages.map((status) => {
              const count = statusCounts[status];
              const width = Math.round((count / maxStatusCount) * 100);
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="uppercase tracking-wider text-gray-500">{status.replace("_", " ")}</span>
                    <span className="font-medium text-[#1A1A1A]">{count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[#ECE8E2]">
                    <div className="h-2 rounded-full bg-[#E55B3C]" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-[#FAF9F7] p-2">
              <p className="text-gray-500">Closed</p>
              <p className="text-lg font-semibold text-[#1A1A1A]">{closed}</p>
            </div>
            <div className="rounded-md bg-[#FAF9F7] p-2">
              <p className="text-gray-500">Lost Rate</p>
              <p className="text-lg font-semibold text-[#1A1A1A]">{lossRate}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#E0DDD9] bg-white p-5">
          <h2 className="text-lg font-medium text-[#1A1A1A]">Pipeline Analytics</h2>
          <p className="mt-1 text-xs text-gray-500">New → Assigned → Follow-up → Interested → Call Denied → Closed/Lost</p>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
            {pipelineStages.map((stage) => (
              <div key={stage} className="rounded-md border border-[#EAE7E2] bg-[#FAF9F7] p-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{stage.replace("_", " ")}</p>
                <p className="text-xl font-semibold text-[#1A1A1A]">{statusCounts[stage]}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-[#EAE7E2] bg-[#FAF9F7] p-3 text-sm">
            <p className="text-gray-600">
              Closed vs Lost: <span className="font-semibold text-[#1A1A1A]">{closed}</span> /{" "}
              <span className="font-semibold text-[#1A1A1A]">{lost}</span>
            </p>
            <p className="mt-1 text-gray-600">
              Overall conversion: <span className="font-semibold text-[#1A1A1A]">{conversionRate}%</span>
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E0DDD9] bg-white p-5">
        <h2 className="text-lg font-medium text-[#1A1A1A]">Agent Performance Metrics</h2>
        <p className="mt-1 text-xs text-gray-500">Assigned leads, completed follow-ups, and conversion by agent.</p>
        <div className="mt-4 space-y-2">
          {agentRows.length === 0 && <p className="text-sm text-gray-500">No agent data available.</p>}
          {agentRows.map((agent) => (
            <div key={agent.id} className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#1A1A1A]">{agent.email}</p>
                <span className="text-xs text-gray-500">{agent.conversionRate}% conversion</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-white px-2 py-1.5">
                  <p className="text-gray-500">Assigned</p>
                  <p className="font-semibold text-[#1A1A1A]">{agent.assigned}</p>
                </div>
                <div className="rounded-md bg-white px-2 py-1.5">
                  <p className="text-gray-500">Completed Follow-ups</p>
                  <p className="font-semibold text-[#1A1A1A]">{agent.completedFollowUps}</p>
                </div>
                <div className="rounded-md bg-white px-2 py-1.5">
                  <p className="text-gray-500">Closed</p>
                  <p className="font-semibold text-[#1A1A1A]">{agent.closed}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E0DDD9] bg-white p-4">
      <p className="text-[11px] uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-[#1A1A1A]">{value}</p>
    </div>
  );
}
