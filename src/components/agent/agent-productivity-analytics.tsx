"use client";

import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadStatus } from "@/lib/auth/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
);

type AgentProductivityAnalyticsProps = {
  pipelineStages: LeadStatus[];
  pipelineCounts: Record<LeadStatus, number>;
  weeklyLabels: string[];
  weeklyCompletedValues: number[];
  weeklyClosedValues: number[];
};

export function AgentProductivityAnalytics({
  pipelineStages,
  pipelineCounts,
  weeklyLabels,
  weeklyCompletedValues,
  weeklyClosedValues,
}: AgentProductivityAnalyticsProps) {
  const pipelineData = {
    labels: pipelineStages.map((stage) => stage.replace("_", " ")),
    datasets: [
      {
        label: "My Pipeline",
        data: pipelineStages.map((stage) => pipelineCounts[stage] ?? 0),
        backgroundColor: ["#dbeafe", "#c7d2fe", "#fde68a", "#bbf7d0", "#fed7aa", "#86efac", "#fecdd3"],
        borderColor: "#ffffff",
        borderWidth: 2,
      },
    ],
  };

  const weeklyTrendData = {
    labels: weeklyLabels,
    datasets: [
      {
        label: "Completed Follow-ups",
        data: weeklyCompletedValues,
        borderColor: "#E55B3C",
        backgroundColor: "rgba(229, 91, 60, 0.2)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      },
      {
        label: "Leads Closed",
        data: weeklyClosedValues,
        borderColor: "#16A34A",
        backgroundColor: "rgba(22, 163, 74, 0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      },
    ],
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card className="border-[#E0DDD9] bg-white xl:col-span-2">
        <CardHeader>
          <CardTitle>Weekly Trend (My Follow-ups Completed)</CardTitle>
        </CardHeader>
        <CardContent>
          <Line
            data={weeklyTrendData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: "top" } },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
            }}
            height={270}
          />
        </CardContent>
      </Card>

      <Card className="border-[#E0DDD9] bg-white">
        <CardHeader>
          <CardTitle>My Pipeline Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Doughnut
            data={pipelineData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: "bottom" } },
            }}
            height={270}
          />
        </CardContent>
      </Card>
    </div>
  );
}
