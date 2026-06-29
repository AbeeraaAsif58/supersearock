"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AgentStatus, LeadStatus } from "@/lib/auth/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

type AgentPerformanceRow = {
  id: string;
  email: string;
  status: AgentStatus;
  assigned: number;
  completedFollowUps: number;
  closed: number;
  conversionRate: number;
};

type DashboardAnalyticsProps = {
  pipelineStages: LeadStatus[];
  statusCounts: Record<LeadStatus, number>;
  dailyTrendLabels: string[];
  dailyTrendValues: number[];
  agentPerformance: AgentPerformanceRow[];
};

export function DashboardAnalytics(props: DashboardAnalyticsProps) {
  const statusLabels = props.pipelineStages.map((stage) => stage.replace("_", " "));
  const statusValues = props.pipelineStages.map((stage) => props.statusCounts[stage] ?? 0);

  const leadTrendData = {
    labels: props.dailyTrendLabels,
    datasets: [
      {
        label: "Leads Created",
        data: props.dailyTrendValues,
        borderColor: "#E55B3C",
        backgroundColor: "rgba(229, 91, 60, 0.2)",
        tension: 0.35,
        fill: true,
        pointRadius: 3,
      },
    ],
  };

  const statusBreakdownData = {
    labels: statusLabels,
    datasets: [
      {
        label: "Lead Status",
        data: statusValues,
        backgroundColor: ["#dbeafe", "#c7d2fe", "#fde68a", "#bbf7d0", "#fed7aa", "#86efac", "#fecdd3"],
        borderColor: "#ffffff",
        borderWidth: 2,
      },
    ],
  };

  const topAgents = props.agentPerformance.slice(0, 6);
  const agentBarData = {
    labels: topAgents.map((agent) => shortenEmail(agent.email)),
    datasets: [
      {
        label: "Assigned",
        data: topAgents.map((agent) => agent.assigned),
        backgroundColor: "#E55B3C",
      },
      {
        label: "Completed Follow-ups",
        data: topAgents.map((agent) => agent.completedFollowUps),
        backgroundColor: "#4F46E5",
      },
    ],
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-[#E0DDD9] bg-white xl:col-span-2">
          <CardHeader>
            <CardTitle>Lead Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <Line
              data={leadTrendData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: "top" } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
              }}
              height={260}
            />
          </CardContent>
        </Card>

        <Card className="border-[#E0DDD9] bg-white">
          <CardHeader>
            <CardTitle>Status Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <Doughnut
              data={statusBreakdownData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } },
              }}
              height={260}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Agent Workload vs Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <Bar
            data={agentBarData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: "top" } },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
            }}
            height={280}
          />
        </CardContent>
      </Card>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>Top Agent Performance Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-[#EAE7E2]">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAF9F7]">
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Completed Follow-ups</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead>Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.agentPerformance.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-gray-500">
                      No performance data available.
                    </TableCell>
                  </TableRow>
                )}
                {props.agentPerformance.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.email}</TableCell>
                    <TableCell className="uppercase text-xs tracking-wide">{agent.status}</TableCell>
                    <TableCell>{agent.assigned}</TableCell>
                    <TableCell>{agent.completedFollowUps}</TableCell>
                    <TableCell>{agent.closed}</TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-[#F4F1ED] px-2 py-0.5 text-[11px] font-semibold text-[#1A1A1A]">
                        {agent.conversionRate}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function shortenEmail(email: string) {
  const [name] = email.split("@");
  if (!name) return email;
  return name.length > 12 ? `${name.slice(0, 12)}...` : name;
}
